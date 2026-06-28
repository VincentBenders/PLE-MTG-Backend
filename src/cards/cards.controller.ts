import {Controller, Get, Post, Body, Patch, Param, Delete, Query} from '@nestjs/common';
import { CardsService } from './cards.service';
import {GetCardsFilterDto} from "./dto/get-cards.dto";

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  async findAll(@Query() filterDto: GetCardsFilterDto = {}) {
    return this.cardsService.getCards(filterDto);
  }
}
