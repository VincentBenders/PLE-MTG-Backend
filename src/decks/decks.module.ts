// src/decks/decks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { Deck } from './entities/deck.entity';
import { CardsModule } from '../cards/cards.module'; // 👈 Import the module, not just the service!

@Module({
  imports: [
    TypeOrmModule.forFeature([Deck]),
    CardsModule // 👈 ADD THIS HERE
  ],
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}