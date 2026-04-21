import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { resolve } from 'node:path';
import configuration from './config/configuration';
import { createDataSource } from './db/data-source';
import { Assignment } from './experiments/entities/assignment.entity';
import { EventEntity } from './experiments/entities/event.entity';
import { Experiment } from './experiments/entities/experiment.entity';
import { Variant } from './experiments/entities/variant.entity';
import { ExperimentsService } from './experiments/experiments.service';
import { HttpError } from './http/http-error';
import { RagService } from './rag/rag.service';
import { eventsRoutes } from './routes/events.routes';
import { experimentsRoutes } from './routes/experiments.routes';
import { ragRoutes } from './routes/rag.routes';
import { usersRoutes } from './routes/sessions.routes';
import { setupSwagger } from './openapi/setup-swagger';


loadEnv({ path: resolve(process.cwd(), '.env') });

async function bootstrap() {
  const cfg = configuration();
  const dataSource = createDataSource(cfg);
  await dataSource.initialize();
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');

  const experimentsService = new ExperimentsService(
    dataSource.getRepository(Experiment),
    dataSource.getRepository(Variant),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(EventEntity),
  );

  const ragService = new RagService(cfg, dataSource);

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    console.log(`[http] ${req.method} ${req.url}`);
    next();
  });

  setupSwagger(app);

  app.use('/experiments', experimentsRoutes(experimentsService));
  app.use('/users', usersRoutes(experimentsService));
  app.use('/events', eventsRoutes(experimentsService));
  app.use('/rag', ragRoutes(ragService));


  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res
        .status(err.statusCode)
        .json({ message: err.message, statusCode: err.statusCode });
    }
    console.error(err);
    return res.status(500).json({
      message: 'Internal Server Error',
      statusCode: 500,
    });
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 8001;
  const server = app.listen(port, () => {
    console.log(
      `Listening on http://localhost:${port} — API docs: http://localhost:${port}/docs`,
    );
  });

  const shutdown = async () => {
    await ragService.destroy().catch(() => undefined);
    await dataSource.destroy().catch(() => undefined);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
