import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import type { DataSource } from 'typeorm';
import type { PoolConfig } from 'pg';
import { join } from 'node:path';
import type { AppConfig } from '../config/configuration';
import { HttpError } from '../http/http-error';
import { EventEntity } from '../experiments/entities/event.entity';
import { ingestProvizyKbToPgVector } from './provizy-kb.ingest';
import { SYNTHETIC_EXPERIMENT_DOCS } from './synthetic-experiments';

type RagTrackingContext = {
  userId?: string;
  experimentId?: number;
  variantId?: number;
};

export class RagService {
  /** Experiment synthetic-docs table (RAG_TABLE_NAME). */
  private store: PGVectorStore | null = null;
  /** Provizy KB table (PROVIZY_KB_TABLE) — separate pool; do not end per request or HTTP never finishes. */
  private kbStore: PGVectorStore | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly dataSource: DataSource,
  ) {}

  async destroy(): Promise<void> {
    for (const s of [this.store, this.kbStore]) {
      const pool = (s as unknown as { pool?: { end: () => Promise<void> } })?.pool;
      if (pool) await pool.end().catch(() => undefined);
    }
    this.store = null;
    this.kbStore = null;
  }

  private requireApiKey(): string {
    const key = this.config.openai.apiKey;
    if (!key) throw new HttpError(400, 'OPENAI_API_KEY is required for RAG endpoints');
    return key;
  }

  /** Shared `pg` pool options so connections fail fast instead of hanging on bad host/port. */
  private pgPoolOptions(): PoolConfig {
    return {
      connectionString: this.config.database.url,
      connectionTimeoutMillis: this.config.database.connectionTimeoutMs,
    };
  }

  private openAiEmbeddings(apiKey: string): OpenAIEmbeddings {
    return new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      model: this.config.openai.embeddingModel,
      timeout: this.config.openai.requestTimeoutMs,
      dimensions: this.config.openai.embeddingDimensions,
    });
  }

  private async getStore(): Promise<PGVectorStore> {
    if (this.store) return this.store;
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    const apiKey = this.requireApiKey();
    const tableName = this.config.rag.tableName;
    const embeddings = this.openAiEmbeddings(apiKey);
    this.store = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: this.pgPoolOptions(),
      tableName,
      dimensions: this.config.openai.embeddingDimensions,
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'vector',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
      distanceStrategy: 'cosine',
    });
    return this.store;
  }

  /** Lazily initialized; reused across `/rag/query-kb` calls (closing the pool per request blocked `res.json`). */
  private async getKbVectorStore(): Promise<PGVectorStore> {
    if (this.kbStore) return this.kbStore;
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    const apiKey = this.requireApiKey();
    const tableName = this.config.rag.kbTableName;
    const embeddings = this.openAiEmbeddings(apiKey);
    this.kbStore = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: this.pgPoolOptions(),
      tableName,
      dimensions: this.config.openai.embeddingDimensions,
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'vector',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
      distanceStrategy: 'cosine',
    });
    return this.kbStore;
  }

  /** Chunk + embed synthetic experiment briefs into PGVector. */
  async ingestSyntheticDocs(): Promise<{ chunksIndexed: number }> {
    await this.requireApiKey();
    const ds = await this.getStore();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 900,
      chunkOverlap: 120,
    });
    const docs: Document[] = [];
    for (let i = 0; i < SYNTHETIC_EXPERIMENT_DOCS.length; i++) {
      const text = SYNTHETIC_EXPERIMENT_DOCS[i]!;
      const parts = await splitter.createDocuments([text], [
        { source: 'synthetic', docIndex: String(i), chunkId: `synth_${i}` },
      ]);
      docs.push(...parts);
    }
    await ds.addDocuments(docs);
    return { chunksIndexed: docs.length };
  }

  /** Embed `provizy_kb_qa.json` into a dedicated PGVector table (OpenAI embeddings). */
  async ingestProvizyKb(): Promise<{ documents: number; tableName: string; rowCount: number }> {
    const apiKey = this.requireApiKey();
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    const url = this.config.database.url;
    const tableName = this.config.rag.kbTableName;
    const embeddingModel = this.config.openai.embeddingModel;
    const jsonPath = join(process.cwd(), 'provizy_kb_qa.json');
    return ingestProvizyKbToPgVector({
      connectionString: url,
      openAIApiKey: apiKey,
      embeddingModel,
      embeddingDimensions: this.config.openai.embeddingDimensions,
      tableName,
      jsonPath,
      verbose: false,
    });
  }

  /**
   * Similarity search over the Provizy KB table (`PROVIZY_KB_TABLE`). Requires `ingest-kb` (or `npm run ingest:kb`) first.
   */
  async queryProvizyKb(
    query: string,
    k = 5,
    tracking?: RagTrackingContext,
  ): Promise<{
    query: string;
    k: number;
    tableName: string;
    matches: {
      score: number;
      pageContent: string;
      metadata: Record<string, unknown>;
    }[];
  }> {
    const q = query.trim();
    const tableName = this.config.rag.kbTableName;
    console.log(`[rag/query-kb] request k=${k} chars=${q.length} table=${tableName}`);
    const store = await this.getKbVectorStore();
    console.log('[rag/query-kb] embedding query + vector search…');
    const started = Date.now();
    try {
      await this.trackEvent('question_asked', tracking, {
        query: q,
        k,
        tableName,
      });
      const rows = await store.similaritySearchWithScore(q, k);
      const latencyMs = Date.now() - started;
      const topIntents = rows
        .map(([doc]) => (doc.metadata as Record<string, unknown> | undefined)?.intent)
        .filter((x): x is string => typeof x === 'string')
        .slice(0, 5);
      await this.trackEvent('query_results', tracking, {
        query: q,
        k,
        tableName,
        matches: rows.length,
        topIntents,
        latencyMs,
      });
      console.log(`[rag/query-kb] ok matches=${rows.length}`);
      return {
        query: q,
        k,
        tableName,
        matches: rows.map(([doc, score]) => ({
          score,
          pageContent: doc.pageContent,
          metadata: (doc.metadata ?? {}) as Record<string, unknown>,
        })),
      };
    } catch (e) {
      console.error('[rag/query-kb] failed:', e);
      await this.trackEvent('query_failed', tracking, {
        query: q,
        k,
        tableName,
        error: String(e),
      }).catch(() => undefined);
      throw e;
    }
  }

  private async trackEvent(
    eventType: string,
    ctx: RagTrackingContext | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!ctx?.userId || !ctx.experimentId) return;
    const repo = this.dataSource.getRepository(EventEntity);
    await repo.save(
      repo.create({
        userId: ctx.userId,
        experimentId: ctx.experimentId,
        variantId: ctx.variantId ?? null,
        eventType,
        payload,
      }),
    );
  }

  /** Advisory RAG: retrieve similar past experiment write-ups, then answer with citations. */
  async advise(experimentGoal: string, query?: string): Promise<{
    answer: string;
    citations: string[];
    retrievedPreview: { citation: string; snippet: string }[];
  }> {
    const apiKey = this.requireApiKey();
    const store = await this.getStore();
    const q = query?.trim() || experimentGoal;
    const k = 4;
    const retrieved = await store.similaritySearch(q, k);

    const retrievedPreview = retrieved.map((d, idx) => {
      const meta = (d.metadata ?? {}) as Record<string, unknown>;
      const citation =
        typeof meta.chunkId === 'string'
          ? meta.chunkId
          : typeof meta.docIndex === 'string'
            ? `doc_${meta.docIndex}_part_${idx}`
            : `chunk_${idx}`;
      const snippet = d.pageContent.slice(0, 280).replace(/\s+/g, ' ');
      return { citation, snippet };
    });

    const context = retrieved
      .map((d, idx) => {
        const meta = (d.metadata ?? {}) as Record<string, unknown>;
        const id =
          typeof meta.chunkId === 'string'
            ? meta.chunkId
            : typeof meta.docIndex === 'string'
              ? `doc_${meta.docIndex}`
              : `chunk_${idx}`;
        return `[${id}] ${d.pageContent}`;
      })
      .join('\n\n');

    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      model: this.config.openai.chatModel,
      temperature: 0.2,
      maxTokens: 500,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are an experimentation advisor. Ground every recommendation in the CONTEXT. If context is insufficient, say so. End with a short "Citations:" line listing bracket ids you used.',
      ],
      [
        'human',
        `Experiment goal:\n{goal}\n\nUser question (optional):\n{userQuery}\n\nCONTEXT:\n{context}`,
      ],
    ]);

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({
      goal: experimentGoal,
      userQuery: query?.trim() || '(none)',
      context,
    });

    const citations = retrievedPreview.map((r) => r.citation);
    return { answer, citations, retrievedPreview };
  }
}
