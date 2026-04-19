import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './spec';

/** Serves Swagger UI at `/docs` and raw OpenAPI JSON at `/openapi.json`. */
export function setupSwagger(app: Express): void {
  app.get('/openapi.json', (_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.send(openApiDocument);
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Experimentation API',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );
}
