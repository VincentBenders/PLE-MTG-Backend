export class CreateDeckDto {
  name: string;
  commander: string;
  decklist: {
    cardId: string;
    cardName: string;
    quantity: number;
    highlighted?: boolean;
    role?: string;
    notes?: string;
  }[];
  tags?: string[];
  bracket: number;
}
