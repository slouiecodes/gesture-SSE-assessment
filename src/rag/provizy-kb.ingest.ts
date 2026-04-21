import { readFileSync } from 'node:fs';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Client } from 'pg';

const TABLE_NAME_SAFE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type ProvizyKbRow = {
  id: string;
  question: string;
  answer: string;
  pageContent: string;
  metadata: {
    section: string;
    intent: string;
    tags?: string[];
    plan?: string;
  };
};

export type IngestProvizyKbOptions = {
  connectionString: string;
  openAIApiKey: string;
  embeddingModel: string;
  /** Must match embedding model output size (e.g. 1536 for text-embedding-3-small). */
  embeddingDimensions: number;
  tableName: string;
  jsonPath: string;
  /** Documents per addDocuments call (default 32) */
  batchSize?: number;
  /** Log progress to stderr (default true for CLI) */
  verbose?: boolean;
};

/**
 * Load `provizy_kb_qa.json`, embed with OpenAI, store in PGVector (dedicated table).
 * Truncates the target table first so re-runs replace the corpus.
 */
function log(verbose: boolean | undefined, msg: string) {
  if (verbose === false) return;
  process.stderr.write(`${msg}\n`);
}

export async function ingestProvizyKbToPgVector(
  opts: IngestProvizyKbOptions,
): Promise<{ documents: number; tableName: string; rowCount: number }> {
  const verbose = opts.verbose !== false;

  if (!TABLE_NAME_SAFE.test(opts.tableName)) {
    throw new Error(
      `Invalid tableName "${opts.tableName}" (use letters, numbers, underscore only)`,
    );
  }

  log(verbose, `[ingest-kb] Reading ${opts.jsonPath}`);
  const raw = readFileSync(opts.jsonPath, 'utf-8');
  const rows = JSON.parse(raw) as ProvizyKbRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No rows in ${opts.jsonPath}`);
  }
  log(verbose, `[ingest-kb] Loaded ${rows.length} Q&A rows. Ensuring DB extension…`);

  const extClient = new Client({ connectionString: opts.connectionString });
  await extClient.connect();
  await extClient.query('CREATE EXTENSION IF NOT EXISTS vector');
  await extClient.end();

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: opts.openAIApiKey,
    model: opts.embeddingModel,
  });

  log(
    verbose,
    `[ingest-kb] Initializing PGVector table "${opts.tableName}" (vector(${opts.embeddingDimensions}))…`,
  );

  const store = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: { connectionString: opts.connectionString },
    tableName: opts.tableName,
    dimensions: opts.embeddingDimensions,
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'vector',
      contentColumnName: 'content',
      metadataColumnName: 'metadata',
    },
    distanceStrategy: 'cosine',
  });

  const pool = (store as unknown as { pool?: { query: (q: string) => Promise<unknown>; end: () => Promise<void> } })
    .pool;
  if (!pool) {
    throw new Error('PGVectorStore: expected internal pool');
  }

  await pool.query(`TRUNCATE TABLE ${opts.tableName}`);
  log(verbose, `[ingest-kb] Truncated "${opts.tableName}". Embedding via OpenAI (may take 1–3 min for ~250 rows)…`);

  const docs = rows.map(
    (r) =>
      new Document({
        pageContent: r.pageContent,
        metadata: {
          qaId: r.id,
          section: r.metadata.section,
          intent: r.metadata.intent,
          tags: r.metadata.tags ?? [],
          ...(r.metadata.plan ? { plan: r.metadata.plan } : {}),
          source: 'provizy_kb',
        },
      }),
  );

  const batchSize = opts.batchSize ?? 32;
  for (let i = 0; i < docs.length; i += batchSize) {
    const end = Math.min(i + batchSize, docs.length);
    log(verbose, `[ingest-kb] Batch ${i + 1}-${end} / ${docs.length}…`);
    await store.addDocuments(docs.slice(i, end));
  }

  const countRes = (await pool.query(
    `SELECT COUNT(*)::text AS c FROM ${opts.tableName}`,
  )) as { rows: Array<{ c?: string }> };
  const rowCount = Number(countRes.rows[0]?.c ?? 0);

  await pool.end();
  log(
    verbose,
    `[ingest-kb] Done. Table public.${opts.tableName} now has ${rowCount} rows (id, content, metadata, vector).`,
  );

  return { documents: docs.length, tableName: opts.tableName, rowCount };
}
