/**
 * Embed provizy_kb_qa.json into Postgres/pgvector using OpenAI embeddings.
 *
 * Usage: npm run ingest:kb
 * Requires: DATABASE_URL, OPENAI_API_KEY, running Postgres (docker compose up -d)
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { ingestProvizyKbToPgVector } from '../rag/provizy-kb.ingest';

config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://exp:exp@localhost:15432/experiments';
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const embeddingDimensions = Number(
    process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536,
  );
  const tableName = process.env.PROVIZY_KB_TABLE ?? 'provizy_kb_docs';
  const jsonPath = resolve(process.cwd(), 'provizy_kb_qa.json');

  const result = await ingestProvizyKbToPgVector({
    connectionString,
    openAIApiKey: apiKey,
    embeddingModel,
    embeddingDimensions,
    tableName,
    jsonPath,
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        embeddingModel,
        embeddingDimensions,
        jsonPath,
        postgresHint: `Check: SELECT COUNT(*) FROM ${tableName}; \\dt public.*`,
      },
      null,
      2,
    ),
  );
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
