import { Router } from 'express';
import { CreateEventDto } from '../experiments/dto/create-event.dto';
import type { ExperimentsService } from '../experiments/experiments.service';
import { asyncHandler } from '../http/async-handler';
import { validateBody } from '../http/validate';

export function eventsRoutes(service: ExperimentsService) {
  const r = Router();

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = await validateBody(CreateEventDto, req.body);
      const ev = await service.logEvent(body);
      res.json(ev);
    }),
  );

  return r;
}
