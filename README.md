# Experiment framework

Backend service for **A/B-style experiments**: define experiments and variants, **sticky assignment** per user, **event logging**, and a simple **experiment summary**. Optional **Provizy KB** search uses **Postgres + pgvector** and OpenAI embeddings (`/rag/query-kb`). Interactive API docs live at **`/docs`** (Swagger UI).

## Stack

- **Node.js**, **Express**, **TypeORM**, **PostgreSQL** with **pgvector** (via Docker)
- **LangChain** + **OpenAI** for embeddings and KB similarity search

## Quick start

1. **Start Postgres** (pgvector image, port `15432` → container `5432`):

   ```bash
   docker compose up -d
   ```

2. **Configure environment** — copy or create `.env` in the project root. Typical variables:

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Postgres connection string (defaults match `docker-compose.yml`) |
   | `OPENAI_API_KEY` | Required for `/rag/query-kb` and for the KB ingest script |
   | `OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_DIMENSIONS` | Must stay consistent with your vector column width (e.g. `1536` for `text-embedding-3-small`) |
   | `PROVIZY_KB_TABLE` | PGVector table name for the KB (default `provizy_kb_docs`) |
   | `PORT` | HTTP port (default **8001**) |

3. **Install and run the API**:

   ```bash
   npm install
   npm run dev
   ```

   - **API**: `http://localhost:8001` (or your `PORT`)
   - **Swagger**: `http://localhost:8001/docs`
   - **OpenAPI JSON**: `http://localhost:8001/openapi.json`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run API with hot reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile TypeScript / run `dist/main.js` |
| `npm run seed` | Seed demo experiment, variants, assignments, and sample events (no embeddings) |
| `npm run ingest:kb` | **One-off** ingest: reads `provizy_kb_qa.json`, embeds with OpenAI, writes vectors to the KB table. Run when you change the JSON or need to refresh vectors—not part of the HTTP API. |

## HTTP API (overview)

- **`/experiments`** — create/list experiments and variants; experiment summary.
- **`/users`** — e.g. `POST /users/:userId/assign` for sticky variant assignment.
- **`/events`** — log structured events (exposures, conversions, custom types).
- **`/rag`** — **`POST /rag/query-kb`** only: similarity search over the ingested KB (requires prior `npm run ingest:kb` and a valid `OPENAI_API_KEY`).

Raw JSON bodies are validated with **class-validator**; errors return structured HTTP error payloads where applicable.

## Data and RAG

- Relational data (experiments, assignments, events) is stored via **TypeORM** entities.
- **KB vectors** are populated by **`npm run ingest:kb`**, which calls the logic in `src/rag/provizy-kb.ingest.ts`. The **`seed`** script does **not** run embeddings; it only inserts demo rows (including synthetic RAG-related *event* payloads for testing summaries).

---

For request/response shapes, use **Swagger at `/docs`** or inspect `src/openapi/spec.ts`.
