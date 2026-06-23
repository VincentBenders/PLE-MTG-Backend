import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('cards')
export class Card {
    @PrimaryColumn({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    text: string;

    // Added to capture the back face of transforming/modal double-faced cards
    @Column({ type: 'text', nullable: true })
    flip_text: string;

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

    @Column({ type: 'simple-array', nullable: true })
    tags: string[];

    @Column({
        default: false,
    })
    isGamechanger: boolean;

    @Column({
        default: false,
    })
    isStaple: boolean;

    @Column({
        default: false,
    })
    isTutor: boolean;

    @Column({
        default: false,
    })
    isCommanderLegal: boolean;

    @Column({
        default: false,
    })
    isCommanderBanned: boolean;

    @Column({
        default: false,
    })
    isFastMana: boolean;

    @Column({
        type: 'varchar',
        nullable: true,
    })
    image_uri: string;
}