import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  import { Variant } from './variant.entity';
  
  @Entity({ name: 'experiments' })
  export class Experiment {
    @PrimaryGeneratedColumn()
    id!: number;
  
    @Column({ type: 'varchar', length: 255 })
    name!: string;
  
    @Column({ type: 'varchar', length: 64, default: 'active' })
    status!: string;
  
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
  
    @OneToMany(() => Variant, (v) => v.experiment)
    variants!: Variant[];
  }
  