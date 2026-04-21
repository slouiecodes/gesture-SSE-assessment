import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  
  @Entity({ name: 'events' })
  export class EventEntity {
    @PrimaryGeneratedColumn()
    id!: number;
  
    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId!: string;
  
    @Column({ name: 'experiment_id', type: 'int' })
    experimentId!: number;
  
    @Column({ name: 'variant_id', type: 'int', nullable: true })
    variantId!: number | null;
  
    @Column({ name: 'event_type', type: 'varchar', length: 64 })
    eventType!: string;
  
    @Column({ type: 'jsonb', nullable: true })
    payload!: Record<string, unknown> | null;
  
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
  }
  