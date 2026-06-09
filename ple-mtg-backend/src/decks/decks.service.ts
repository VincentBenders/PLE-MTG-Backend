// src/decks/decks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deck } from './entities/deck.entity';

@Injectable()
export class DecksService {
  constructor(
      @InjectRepository(Deck)
      private readonly deckRepository: Repository<Deck>,
  ) {}

  async create(createDeckDto: CreateDeckDto): Promise<Deck> {
    const deck = this.deckRepository.create(createDeckDto);

    deck.infiniteCombos = await this.checkInfiniteCombos(deck.deck);

    return await this.deckRepository.save(deck);
  }

  async findAll(): Promise<Deck[]> {
    return await this.deckRepository.find();
  }

  async findOne(id: string): Promise<Deck> {
    const deck = await this.deckRepository.findOne({ where: { id } });
    if (!deck) {
      throw new NotFoundException(`Deck with ID ${id} not found`);
    }
    return deck;
  }

  async update(id: string, updateDeckDto: UpdateDeckDto): Promise<Deck> {
    const deck = await this.findOne(id);

    const updatedDeck = this.deckRepository.merge(deck, updateDeckDto);

    if (updateDeckDto.deck) {
      updatedDeck.infiniteCombos = await this.checkInfiniteCombos(updatedDeck.deck);
    }

    return await this.deckRepository.save(updatedDeck);
  }

  async remove(id: string): Promise<void> {
    const result = await this.deckRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Deck with ID ${id} not found`);
    }
  }

  async getFavoriteDecks(): Promise<Deck[]> {
    return await this.deckRepository.find({
      where: {
        favorite: true,
        // userId: currentUser.id,
      },
    });
  }

  public async checkInfiniteCombos(deckData: any): Promise<any[]> {
    try {
      let cardNames: string[] = [];

      if (Array.isArray(deckData)) {
        cardNames = deckData.map(card => {
          if (typeof card === 'string') return card;
          return card?.name || card?.title;
        }).filter(Boolean);
      } else if (typeof deckData === 'object' && deckData !== null) {
        const possibleArray = deckData.cards || deckData.list || [];
        if (Array.isArray(possibleArray)) {
          cardNames = possibleArray.map(card => typeof card === 'string' ? card : card?.name).filter(Boolean);
        }
      }

      if (cardNames.length === 0) {
        console.warn('checkInfiniteCombos received an empty or unparseable deck list.');
        return [];
      }

      const payload = {
        cards: cardNames
      };

      const response = await fetch(
          `https://backend.commanderspellbook.com/find-my-combos?count=false`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data?.results?.included || [];
    } catch (error) {
      console.error('Failed to fetch infinite combos:', error);
      return [];
    }
  }
}