import { Exclude, Expose } from 'class-transformer';

export class DeckResponseDto {
  @Expose()
  deckId: string;
  @Expose()
  name: string;
  @Expose()
  commander: string;
  @Expose()
  decklist: string;
  @Expose()
  favorite: boolean;
  @Expose()
  games: number;
  @Expose()
  draws: number;
  @Expose()
  wins: number;
  @Expose()
  tags: string[];
  @Expose()
  bracket: string;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  deletedAt: Date;
}
