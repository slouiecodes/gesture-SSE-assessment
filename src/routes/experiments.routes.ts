import { Router } from 'express';
import { CreateExperimentDto } from '../experiments/dto/create-experiment.dto';
import type { ExperimentsService } from '../experiments/experiments.service';
import { asyncHandler } from '../http/async-handler';
import { parseIntParam } from '../http/parse-params';
import { validateBody } from '../http/validate';

export function experimentsRoutes(service: ExperimentsService) {
  const r = Router();

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = await validateBody(CreateExperimentDto, req.body);
      const exp = await service.createExperiment(body);
      res.json(exp);
    }),
  );

  r.get(
    '/:experimentId/summary',
    asyncHandler(async (req, res) => {
      const experimentId = parseIntParam(req.params.experimentId, 'experimentId');
      const summary = await service.summarize(experimentId);
      res.json(summary);
    }),
  );

  r.get(
    '/:experimentId',
    asyncHandler(async (req, res) => {
      const experimentId = parseIntParam(req.params.experimentId, 'experimentId');
      const exp = await service.findExperiment(experimentId);
      res.json(exp);
    }),
  );

  return r;
}
