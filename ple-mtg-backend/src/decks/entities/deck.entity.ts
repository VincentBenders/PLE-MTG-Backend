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
