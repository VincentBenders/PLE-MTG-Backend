import {Injectable, NotFoundException} from '@nestjs/common';
import {Card} from "./entities/card.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {In, Repository} from "typeorm";
import {GetCardsFilterDto} from "./dto/get-cards.dto";

@Injectable()
export class CardsService {
  constructor(
      @InjectRepository(Card)
      private readonly cardRepository: Repository<Card>,
  ) {}

  async getCards(filterDto: GetCardsFilterDto) {
    const { name, setCode, rarity, page = 1, limit = 20 } = filterDto;

    const query = this.cardRepository.createQueryBuilder('card');

    if (name) {
      query.andWhere('LOWER(card.name) LIKE LOWER(:name)', { name: `%${name}%` });
    }

    if (setCode) {
      query.andWhere('card.setCode = :setCode', { setCode });
    }

    if (rarity) {
      query.andWhere('card.rarity = :rarity', { rarity });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    query.orderBy('card.name', 'ASC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findOne(name: string): Promise<Card> {
    const card = await this.cardRepository.findOne({ where: { name } });

    if (!card) {
      throw new NotFoundException(`Card with name: ${name} not found`);
    }

    return card;
  }

  async findByNames(names: string[]): Promise<Card[]> {
    return await this.cardRepository.findBy({
      name: In(names),
    });
  }
}
