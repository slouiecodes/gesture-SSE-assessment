/**
 * Seeds Postgres with a demo experiment, multiple variants, and realistic synthetic events.
 *
 * Bootstraps the same TypeORM schema as the API (`synchronize: true`), so you do **not**
 * need to start the API first — only Docker Postgres and a valid `DATABASE_URL` in `.env`.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Assignment } from '../../src/experiments/entities/assignment.entity';
import { EventEntity } from '../../src/experiments/entities/event.entity';
import { Experiment } from '../../src/experiments/entities/experiment.entity';
import { Variant } from '../../src/experiments/entities/variant.entity';

config({ path: resolve(process.cwd(), '.env') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://exp:exp@localhost:5432/experiments';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [Experiment, Variant, Assignment, EventEntity],
    synchronize: true,
    logging: false,
  });

  await ds.initialize();
  await ds.query('CREATE EXTENSION IF NOT EXISTS vector');

  await ds.transaction(async (trx) => {
    const eRepo = trx.getRepository(EventEntity);
    const aRepo = trx.getRepository(Assignment);
    const vRepo = trx.getRepository(Variant);
    const xRepo = trx.getRepository(Experiment);

    await eRepo.createQueryBuilder().delete().execute();
    await aRepo.createQueryBuilder().delete().execute();
    await vRepo.createQueryBuilder().delete().execute();
    await xRepo.createQueryBuilder().delete().execute();

    const exp = xRepo.create({ name: 'Demo: RAG + CTA', status: 'active' });
    await xRepo.save(exp);

    const vA = vRepo.create({
      experiment: { id: exp.id } as Experiment,
      key: 'A',
      config: { ui: { ctaCopy: 'Buy credits' }, rag: { k: 5 } },
    });
    const vB = vRepo.create({
      experiment: { id: exp.id } as Experiment,
      key: 'B',
      config: { ui: { ctaCopy: 'Get more credits' }, rag: { k: 8 } },
    });
    const vC = vRepo.create({
      experiment: { id: exp.id } as Experiment,
      key: 'C',
      config: { ui: { ctaCopy: 'Top up credits' }, rag: { k: 10 } },
    });
    await vRepo.save([vA, vB, vC]);

    const idA = vA.id;
    const idB = vB.id;
    const idC = vC.id;
    const experimentId = exp.id;

    const users = Array.from({ length: 12 }, (_, i) => `seed_user_${i + 1}`);
    const variants = [idA, idB, idC];
    const pickVariant = (uid: string) => {
      // Stable-ish split by suffix
      const n = Number(uid.replace(/\D/g, '')) || 0;
      return variants[n % variants.length]!;
    };

    for (const uid of users) {
      const variantId = pickVariant(uid);

      // Optional: store sticky assignment record (mirrors what the API does)
      await aRepo.save(
        aRepo.create({
          userId: uid,
          experimentId,
          variantId,
        }),
      );

      await eRepo.save(
        eRepo.create({
          userId: uid,
          experimentId,
          variantId,
          eventType: 'exposure',
          payload: { source: 'seed' },
        }),
      );

      // RAG behavior events (as if they used /rag/query-kb with tracking)
      const asked = Math.random() < 0.75;
      if (asked) {
        const q =
          Math.random() < 0.5 ? 'How do I buy credits?' : 'What is a source?';
        const k = variantId === idA ? 5 : variantId === idB ? 8 : 10;
        await eRepo.save(
          eRepo.create({
            userId: uid,
            experimentId,
            variantId,
            eventType: 'rag_question_asked',
            payload: { query: q, k, tableName: 'provizy_kb_docs' },
          }),
        );
        await eRepo.save(
          eRepo.create({
            userId: uid,
            experimentId,
            variantId,
            eventType: 'rag_query_results',
            payload: {
              query: q,
              k,
              tableName: 'provizy_kb_docs',
              matches: k,
              topIntents:
                q.includes('credits') ? ['credits', 'pricing'] : ['how_it_works'],
              latencyMs: Math.round(200 + Math.random() * 1800),
            },
          }),
        );
      }

      // Click events
      const clickVisit = Math.random() < 0.25;
      if (clickVisit) {
        await eRepo.save(
          eRepo.create({
            userId: uid,
            experimentId,
            variantId,
            eventType: 'click_visit_website',
            payload: { source: 'seed', url: 'https://example.com' },
          }),
        );
      }

      const clickBuy = Math.random() < (variantId === idB ? 0.55 : 0.35);
      if (clickBuy) {
        await eRepo.save(
          eRepo.create({
            userId: uid,
            experimentId,
            variantId,
            eventType: 'click_buy_credits',
            payload: { source: 'seed' },
          }),
        );
      }

      // Conversions (skew B as best)
      const convRate = variantId === idB ? 0.28 : variantId === idC ? 0.16 : 0.12;
      if (Math.random() < convRate) {
        await eRepo.save(
          eRepo.create({
            userId: uid,
            experimentId,
            variantId,
            eventType: 'conversion',
            payload: { source: 'seed' },
          }),
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          experimentId,
          variantIds: { A: idA, B: idB, C: idC },
          hint: `GET http://localhost:3000/experiments/${experimentId}/summary`,
        },
        null,
        2,
      ),
    );
  });

  await ds.destroy();
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
  if (code === '28P01') {
    // eslint-disable-next-line no-console
    console.error(
      '\nHint: auth failed. Check DATABASE_URL in .env. If using compose defaults, reset volume: docker compose down -v && docker compose up -d',
    );
  }
  process.exit(1);
});
