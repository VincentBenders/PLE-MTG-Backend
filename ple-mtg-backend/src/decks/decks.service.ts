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
  async create(createDeckDto: CreateDeckDto) {
    const deck = this.deckRepository.create(createDeckDto);
    return await this.deckRepository.save(deck);
  }

  findAll() {
    return this.deckRepository.find();
  }

  async findOne(id: string) {
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
