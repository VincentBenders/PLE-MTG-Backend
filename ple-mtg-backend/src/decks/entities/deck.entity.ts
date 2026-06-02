import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// 1. Define the shape of a single card inside the database JSONB block
type CardEntry = {
  cardId?: string;
  cardName: string;
  quantity: number;
  highlighted?: boolean;
  role?: string;
  notes?: string;
};

// 2. Define the new nested database structure shape
type NestedDeckStructure = {
  main: CardEntry[];
  commanders: CardEntry[];
};

@Entity({ name: 'decks' })
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: false })
  favorite: boolean;

  @Column()
  commander: string;

  // 🔄 SWAPPED 'decklist' FOR THE NESTED 'deck' JSONB PROPERTY
  @Column({
    type: 'jsonb',
    default: () => '\'{"main": [], "commanders": []}\'',
  })
  deck: NestedDeckStructure;

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
