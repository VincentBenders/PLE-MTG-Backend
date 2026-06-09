import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('cards')
export class Card {
    @PrimaryColumn({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    text: string;

    @Column({ type: 'varchar', nullable: true })
    manaCost: string;

    @Column({ type: 'varchar', nullable: true })
    type: string;

    @Column({ type: 'varchar', nullable: true })
    power: string;

    @Column({ type: 'varchar', nullable: true })
    toughness: string;

    @Column({ type: 'simple-array', nullable: true })
    colors: string[];

    @Column({ type: 'simple-array', nullable: true, name: 'colorIdentity' })
    colorIdentity: string[];
}