import { Injectable } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deck } from './entities/deck.entity';

@Injectable()
export class DecksService {
  constructor(
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
  ) {}

  async getFavoriteDecks() {
    return this.deckRepository.find({
      where: {
        favorite: true,
        // userId: currentUser.id,
      },
    });
  }

  async checkInfiniteCombos(deck) {
    try {
      const deckCombos = await fetch(
        `https://backend.commanderspellbook.com/find-my-combos?count=false`,
        {
          headers: {
            accept: 'application/json',
          },
            body: JSON.stringify({deck})
        },
      );
      // if (deckCombos.)
      return await deckCombos.json();
    } catch (error) {
      console.error(error);

    }
  }

  async create(createDeckDto: CreateDeckDto) {
    const deck = this.deckRepository.create(createDeckDto);
    const infiniteCombos = this.checkInfiniteCombos(deck.deck);
    // deck.infiniteCombos = infiniteCombos;
    return await this.deckRepository.save(deck);
  }

  findAll() {
    return this.deckRepository.find();
  }

  async findOne(id: string) {
    // return this.checkInfiniteCombos();
    return await this.deckRepository.findOne({ where: { id } });
  }

  update(id: string, updateDeckDto: UpdateDeckDto) {
    return `This action updates a #${id} deck`;
  }

  async remove(id: string) {
    const deck = this.deckRepository.delete(id);
    return await deck;
  }
}
