import { Router } from 'express';
import { AssignBodyDto } from '../experiments/dto/assign.dto';
import type { ExperimentsService } from '../experiments/experiments.service';
import { asyncHandler } from '../http/async-handler';
import { validateBody } from '../http/validate';

export function usersRoutes(service: ExperimentsService) {
  const r = Router();

  r.post(
    '/:userId/assign',
    asyncHandler(async (req, res) => {
      const body = await validateBody(AssignBodyDto, req.body);
      const userId = req.params.userId ?? '';
      const { variantId, variantKey } = await service.assignVariant(
        userId,
        body.experimentId,
      );
      res.json({
        userId,
        experimentId: body.experimentId,
        variantId,
        variantKey,
      });
    }),
  );

  return r;
}
