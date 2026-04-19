import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
  } from 'typeorm';
  import { Experiment } from './experiment.entity';
  
  @Entity({ name: 'variants' })
  @Unique(['experiment', 'key'])
  export class Variant {
    @PrimaryGeneratedColumn()
    id!: number;
  
    @ManyToOne(() => Experiment, (e) => e.variants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'experiment_id' })
    experiment!: Experiment;
  
    @Column({ type: 'varchar', length: 8 })
    key!: string;
  
    @Column({ type: 'jsonb', nullable: true })
    config!: Record<string, unknown> | null;
  }
  