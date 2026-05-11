import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ForeignKey,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'decks' })
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @ForeignKey('uuid')
  // user_id: string;

  @Column()
  name: string;

  @Column({ default: false })
  favorite: boolean;

  @Column()
  commander: string;

  @Column({ type: 'text' })
  decklist: string;

  @Column({ default: 0 })
  games: number;

  @Column({ default: 0 })
  draws: number;

  @Column({ default: 0 })
  wins: number;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column()
  bracket: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
