import { createHash } from 'crypto';
import type { Repository } from 'typeorm';
import { HttpError } from '../http/http-error';
import type { CreateEventDto } from './dto/create-event.dto';
import type { CreateExperimentDto } from './dto/create-experiment.dto';
import { Assignment } from './entities/assignment.entity';
import { EventEntity } from './entities/event.entity';
import { Experiment } from './entities/experiment.entity';
import { Variant } from './entities/variant.entity';

export type ExperimentMetrics = {
  experimentId: number;
  variants: {
    variantId: number;
    variantKey: string;
    exposures: number;
    conversions: number;
    conversionRate: number;
  }[];
};

export class ExperimentsService {
  constructor(
    private readonly experiments: Repository<Experiment>,
    private readonly variants: Repository<Variant>,
    private readonly assignments: Repository<Assignment>,
    private readonly events: Repository<EventEntity>,
  ) {}

  async createExperiment(dto: CreateExperimentDto): Promise<Experiment> {
    const exp = this.experiments.create({
      name: dto.name,
      status: dto.status ?? 'active',
    });
    await this.experiments.save(exp);
    for (const v of dto.variants) {
      await this.variants.save(
        this.variants.create({
          experiment: { id: exp.id } as Experiment,
          key: v.key,
          config: v.config ?? null,
        }),
      );
    }
    return this.findExperiment(exp.id);
  }

  async findExperiment(id: number): Promise<Experiment> {
    const exp = await this.experiments.findOne({
      where: { id },
      relations: { variants: true },
    });
    if (!exp) throw new HttpError(404, 'Experiment not found');
    exp.variants.sort((a, b) => a.key.localeCompare(b.key));
    return exp;
  }

  private pickVariantIndex(userId: string, experimentId: number, n: number) {
    const h = createHash('sha256')
      .update(`${userId}:${experimentId}`)
      .digest('hex');
    return Number.parseInt(h.slice(0, 16), 16) % n;
  }

  async assignVariant(
    userId: string,
    experimentId: number,
  ): Promise<{ variantId: number; variantKey: string }> {
    const existing = await this.assignments.findOne({
      where: { userId, experimentId },
    });
    if (existing) {
      const v = await this.variants.findOneByOrFail({ id: existing.variantId });
      return { variantId: v.id, variantKey: v.key };
    }

    const exp = await this.experiments.findOne({ where: { id: experimentId } });
    if (!exp) throw new HttpError(404, 'Experiment not found');

    const vars = await this.variants.find({
      where: { experiment: { id: experimentId } },
      order: { id: 'ASC' },
    });
    if (!vars.length) throw new HttpError(400, 'Experiment has no variants');

    const idx = this.pickVariantIndex(userId, experimentId, vars.length);
    const chosen = vars[idx]!;

    await this.assignments.save(
      this.assignments.create({
        userId,
        experimentId,
        variantId: chosen.id,
      }),
    );
    await this.events.save(
      this.events.create({
        userId,
        experimentId,
        variantId: chosen.id,
        eventType: 'exposure',
        payload: { source: 'assignment' },
      }),
    );

    return { variantId: chosen.id, variantKey: chosen.key };
  }

  async logEvent(dto: CreateEventDto): Promise<EventEntity> {
    const exp = await this.experiments.findOneBy({ id: dto.experimentId });
    if (!exp) throw new HttpError(404, 'Experiment not found');
    if (dto.variantId != null) {
      const v = await this.variants.findOne({
        where: {
          id: dto.variantId,
          experiment: { id: dto.experimentId },
        },
      });
      if (!v) throw new HttpError(400, 'Invalid variant_id for experiment');
    }
    return this.events.save(
      this.events.create({
        userId: dto.userId,
        experimentId: dto.experimentId,
        variantId: dto.variantId ?? null,
        eventType: dto.eventType,
        payload: dto.payload ?? null,
      }),
    );
  }

  /** Per-variant exposure/conversion counts and conversion rate (no winner selection). */
  async summarize(experimentId: number): Promise<ExperimentMetrics> {
    const exp = await this.experiments.findOneBy({ id: experimentId });
    if (!exp) throw new HttpError(404, 'Experiment not found');

    const vars = await this.variants.find({
      where: { experiment: { id: experimentId } },
      order: { key: 'ASC' },
    });
    const variantKeys = new Map(vars.map((v) => [v.id, v.key]));

    const rows = await this.events
      .createQueryBuilder('e')
      .select('e.variantId', 'variantId')
      .addSelect('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'cnt')
      .where('e.experimentId = :experimentId', { experimentId })
      .andWhere('e.variantId IS NOT NULL')
      .andWhere(`e.eventType IN ('exposure','conversion')`)
      .groupBy('e.variantId')
      .addGroupBy('e.eventType')
      .getRawMany<{ variantId: string; eventType: string; cnt: string }>();

    const counts = new Map<number, { exposure: number; conversion: number }>();
    for (const v of vars) {
      counts.set(v.id, { exposure: 0, conversion: 0 });
    }
    for (const r of rows) {
      const vid = Number(r.variantId);
      if (!counts.has(vid)) counts.set(vid, { exposure: 0, conversion: 0 });
      const bucket = counts.get(vid)!;
      const n = Number(r.cnt);
      if (r.eventType === 'exposure') bucket.exposure = n;
      if (r.eventType === 'conversion') bucket.conversion = n;
    }

    const variants: ExperimentMetrics['variants'] = [];
    for (const [variantId, key] of variantKeys) {
      const c = counts.get(variantId) ?? { exposure: 0, conversion: 0 };
      const exposures = c.exposure;
      const conversions = c.conversion;
      const conversionRate =
        exposures > 0 ? Math.round((conversions / exposures) * 1e6) / 1e6 : 0;
      variants.push({
        variantId,
        variantKey: key,
        exposures,
        conversions,
        conversionRate,
      });
    }
    variants.sort((a, b) => a.variantKey.localeCompare(b.variantKey));

    return { experimentId, variants };
  }
}
