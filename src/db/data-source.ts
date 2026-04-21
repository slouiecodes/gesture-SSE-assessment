import { DataSource } from 'typeorm';
import type { AppConfig } from '../config/configuration';
import { Assignment } from '../experiments/entities/assignment.entity';
import { EventEntity } from '../experiments/entities/event.entity';
import { Experiment } from '../experiments/entities/experiment.entity';
import { Variant } from '../experiments/entities/variant.entity';

export function createDataSource(config: AppConfig): DataSource {
  return new DataSource({
    type: 'postgres',
    url: config.database.url,
    entities: [Experiment, Variant, Assignment, EventEntity],
    synchronize: true,
    logging: false,
  });
}
