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
  infiniteCombos: any;
  @Expose()
  tags: string[];
  @Expose()
  bracket: number;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  deletedAt: Date;
}
