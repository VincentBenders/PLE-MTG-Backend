export class CreateDeckDto {
  commander: string;
  name: string;
  decklist: string;
  favorite: boolean;
  games: number;
  draws: number;
  wins: number;
  tags: string[];
  bracket: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}
