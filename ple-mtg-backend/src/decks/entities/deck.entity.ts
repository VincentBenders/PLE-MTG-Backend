import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

type DeckEntry = {
  cardId: string;
  cardName: string;

  quantity: number;

  highlighted?: boolean;

  role?: string;

  notes?: string;
};

@Entity({ name: 'decks' })
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // future:
  // @Column()
  // userId: string;

  @Column()
  name: string;

  @Column({ default: false })
  favorite: boolean;

  @Column()
  commander: string;

  @Column({
    type: 'jsonb',
    default: () => "'[]'",
  })
  decklist: DeckEntry[];

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  tags: string[];

  @Column({ default: 0 })
  games: number;

  @Column({ default: 0 })
  draws: number;

  @Column({ default: 0 })
  wins: number;

  @Column()
  bracket: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
