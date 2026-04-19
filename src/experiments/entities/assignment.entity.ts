import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'assignments' })
@Unique(['userId', 'experimentId'])
export class Assignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'varchar', length: 255 })
  userId!: string;

  @Column({ name: 'experiment_id', type: 'int' })
  experimentId!: number;

  @Column({ name: 'variant_id', type: 'int' })
  variantId!: number;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;
}
