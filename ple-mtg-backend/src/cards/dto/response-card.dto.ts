import { Expose } from 'class-transformer';

export class CardResponseDto {
    @Expose()
    uuid: string;

    @Expose()
    name: string;

    @Expose()
    text: string;

    @Expose()
    manaCost: string;

    @Expose()
    type: string;

    @Expose()
    rarity: string;

    @Expose()
    power: string;

    @Expose()
    toughness: string;

    @Expose()
    setCode: string;

    @Expose()
    colors: string[];
}