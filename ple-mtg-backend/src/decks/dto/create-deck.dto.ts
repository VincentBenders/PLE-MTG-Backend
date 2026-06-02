export class CreateDeckDto {
  name: string;
  commander: string;
  deck: {
    main: [
      {
        cardId?: string;
        cardName: string;
        quantity: number;
        highlighted?: boolean;
        role?: string;
        notes?: string;
      },
    ];
    commanders: [];
  };
  tags?: string[];
  bracket: number;
}
