/**
 * OpenAPI 3 document for the HTTP API (served by Swagger UI at `/docs`).
 * Keep in sync with `src/routes/*.routes.ts` and DTOs.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Experimentation API',
    description:
      'A/B experiment assignment, events, experiment summaries, and Provizy KB search (vectors loaded offline; see npm run ingest:kb).',
    version: '0.1.0',
  },
  servers: [{ url: '/', description: 'Same origin as this service' }],
  tags: [
    { name: 'experiments', description: 'Experiments and winner summary' },
    { name: 'users', description: 'Sticky variant assignment' },
    { name: 'events', description: 'Event logging' },
    { name: 'rag', description: 'Provizy KB ingest and similarity search' },
  ],
  paths: {
    '/experiments': {
      post: {
        tags: ['experiments'],
        summary: 'Create experiment',
        operationId: 'createExperiment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateExperimentDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Experiment with variants',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Experiment' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/experiments/{experimentId}': {
      get: {
        tags: ['experiments'],
        summary: 'Get experiment by id',
        operationId: 'getExperiment',
        parameters: [{ $ref: '#/components/parameters/experimentId' }],
        responses: {
          '200': {
            description: 'Experiment with variants',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Experiment' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/experiments/{experimentId}/summary': {
      get: {
        tags: ['experiments'],
        summary: 'Experiment summary and winner (skeleton rule)',
        operationId: 'getExperimentSummary',
        parameters: [{ $ref: '#/components/parameters/experimentId' }],
        responses: {
          '200': {
            description: 'Aggregates + winner',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExperimentSummary' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/users/{userId}/assign': {
      post: {
        tags: ['users'],
        summary: 'Assign sticky variant for a user',
        operationId: 'assignVariant',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssignBodyDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Assignment result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssignResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/events': {
      post: {
        tags: ['events'],
        summary: 'Log an event',
        operationId: 'logEvent',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEventDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created event row',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Event' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/rag/query-kb': {
      post: {
        tags: ['rag'],
        summary: 'Similarity search over Provizy KB',
        operationId: 'ragQueryKb',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/QueryKbDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Matches with scores',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryKbResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
  },
  components: {
    parameters: {
      experimentId: {
        name: 'experimentId',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
      },
    },
    responses: {
      BadRequest: {
        description: 'Validation or domain error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HttpErrorBody' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HttpErrorBody' },
          },
        },
      },
    },
    schemas: {
      HttpErrorBody: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
      VariantCreateDto: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', maxLength: 8 },
          config: { type: 'object', additionalProperties: true },
        },
      },
      CreateExperimentDto: {
        type: 'object',
        required: ['name', 'variants'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', maxLength: 64 },
          variants: {
            type: 'array',
            minItems: 1,
            items: { $ref: '#/components/schemas/VariantCreateDto' },
          },
        },
      },
      Variant: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          config: { nullable: true, type: 'object', additionalProperties: true },
        },
      },
      Experiment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          variants: {
            type: 'array',
            items: { $ref: '#/components/schemas/Variant' },
          },
        },
      },
      VariantStats: {
        type: 'object',
        properties: {
          variantId: { type: 'integer' },
          variantKey: { type: 'string' },
          exposures: { type: 'integer' },
          conversions: { type: 'integer' },
          conversionRate: { type: 'number' },
        },
      },
      ExperimentSummary: {
        type: 'object',
        properties: {
          experimentId: { type: 'integer' },
          minExposuresForWinner: { type: 'integer' },
          variants: {
            type: 'array',
            items: { $ref: '#/components/schemas/VariantStats' },
          },
          winnerVariantId: { type: 'integer', nullable: true },
          winnerVariantKey: { type: 'string', nullable: true },
          winnerReason: { type: 'string' },
        },
      },
      AssignBodyDto: {
        type: 'object',
        required: ['experimentId'],
        properties: {
          experimentId: { type: 'integer', minimum: 1 },
        },
      },
      AssignResponse: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          experimentId: { type: 'integer' },
          variantId: { type: 'integer' },
          variantKey: { type: 'string' },
        },
      },
      CreateEventDto: {
        type: 'object',
        required: ['userId', 'experimentId', 'eventType'],
        properties: {
          userId: { type: 'string' },
          experimentId: { type: 'integer', minimum: 1 },
          variantId: { type: 'integer', minimum: 1, nullable: true },
          eventType: { type: 'string' },
          payload: { nullable: true, type: 'object', additionalProperties: true },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'string' },
          experimentId: { type: 'integer' },
          variantId: { type: 'integer', nullable: true },
          eventType: { type: 'string' },
          payload: { nullable: true, type: 'object', additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      QueryKbDto: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 2 },
          k: { type: 'integer', minimum: 1, maximum: 30 },
          userId: { type: 'string' },
          experimentId: { type: 'integer', minimum: 1 },
          variantId: { type: 'integer', minimum: 1 },
        },
      },
      QueryKbMatch: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          pageContent: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      QueryKbResponse: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          k: { type: 'integer' },
          tableName: { type: 'string' },
          matches: {
            type: 'array',
            items: { $ref: '#/components/schemas/QueryKbMatch' },
          },
        },
      },
    },
  },
} as const;
