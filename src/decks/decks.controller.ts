import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DecksService } from './decks.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import {ComparePodDto} from "./dto/compare-pod.dto";

@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post()
  createDeck(@Body() createDeckDto: CreateDeckDto) {
    return this.decksService.create(createDeckDto);
  }

  @Get()
  findAll() {
    return this.decksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.decksService.findOne(id);
  }

  //for testing
  @Get('combos/:id')
  async checkInfiniteCombos(@Param('id') id: string) {
    const deck = await this.decksService.findOne(id);
    return this.decksService.checkInfiniteCombos(deck.deck);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeckDto: UpdateDeckDto) {
    return this.decksService.update(id, updateDeckDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.decksService.remove(id);
  }

  @Post('compare')
  async comparePod(@Body() comparePodDto: ComparePodDto) {
    return this.decksService.comparePod(comparePodDto);
  }
}