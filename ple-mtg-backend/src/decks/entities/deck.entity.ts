import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'decks' })
export class Deck {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  favorite: string;

  @Column()
  commander: string;

  @Column({ type: 'text' })
  decklist: string;

  @Column()
  games: number;

  @Column()
  draws: number;

  @Column()
  wins: number;

  @Column()
  tags: string;

  @Column()
  bracket: number;
}
