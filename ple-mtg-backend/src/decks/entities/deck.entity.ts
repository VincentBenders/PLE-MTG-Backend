import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

type CardEntry = {
  cardId?: string;
  card: string;
  quantity: number;
  highlighted?: boolean;
  role?: string;
  notes?: string;
};

type NestedDeckStructure = {
  main: CardEntry[];
  commanders: CardEntry[];
  sideboard?: CardEntry[];
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

  @Column({
      type: 'jsonb',
      nullable: true,
  })
  infiniteCombos:  {};

  @Column({ type: 'int', default: 1 })
  bracket: number;

  @Column({ type: 'boolean', default: false })
  isManualBracketOverride: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
  averageCmc: number;

  @Column({ type: 'int', default: 0 })
  gamechangerCount: number;

  @Column({ type: 'int', default: 0 })
  stapleCount: number;

  @Column({ type: 'int', default: 0 })
  tutorCount: number;

  @Column({ type: 'int', default: 0 })
  fastManaCount: number; // Cached count of cards tagged 'fast-mana'
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
