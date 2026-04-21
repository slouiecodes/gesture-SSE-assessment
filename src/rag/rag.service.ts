import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import type { DataSource } from 'typeorm';
import type { PoolConfig } from 'pg';
import type { AppConfig } from '../config/configuration';
import { HttpError } from '../http/http-error';
import { EventEntity } from '../experiments/entities/event.entity';

type RagTrackingContext = {
  userId?: string;
  experimentId?: number;
  variantId?: number;
};

export class RagService {
  /** Provizy KB table (PROVIZY_KB_TABLE) — separate pool; do not end per request or HTTP never finishes. */
  private kbStore: PGVectorStore | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly dataSource: DataSource,
  ) {}

  async destroy(): Promise<void> {
    const pool = (this.kbStore as unknown as { pool?: { end: () => Promise<void> } })?.pool;
    if (pool) await pool.end().catch(() => undefined);
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

  /**
   * Similarity search over the Provizy KB table (`PROVIZY_KB_TABLE`).
   * Load vectors first via `npm run ingest:kb` (or your own ingest script).
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
}
