const configuration = () => ({
    database: {
      url: process.env.DATABASE_URL ?? 'postgres://exp:exp@localhost:15432/experiments',
      /** Max wait when opening a TCP connection to Postgres (LangChain PGVector pools). */
      connectionTimeoutMs: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 15_000),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      /** Vector width for PGVector column; must match the embedding model (1536 for text-embedding-3-small / ada-002). */
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      /** Per-request timeout for OpenAI HTTP calls (embeddings / chat). */
      requestTimeoutMs: Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? 120_000),
    },
    
    rag: {
      kbTableName: process.env.PROVIZY_KB_TABLE ?? 'provizy_kb_docs',
    },
  });
  
  export type AppConfig = ReturnType<typeof configuration>;
  export default configuration;