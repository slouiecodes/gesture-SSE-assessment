import { Router } from 'express';
import { QueryKbDto } from '../rag/dto/query-kb.dto';
import type { RagService } from '../rag/rag.service';
import { asyncHandler } from '../http/async-handler';
import { validateBody } from '../http/validate';

export function ragRoutes(rag: RagService) {
  const r = Router();

  r.post(
    '/query-kb',
    asyncHandler(async (req, res) => {
      const body = await validateBody(QueryKbDto, req.body);
      const out = await rag.queryProvizyKb(body.query, body.k ?? 5, {
        userId: body.userId,
        experimentId: body.experimentId,
        variantId: body.variantId,
      });
      res.json(out);
    }),
  );

  return r;
}
