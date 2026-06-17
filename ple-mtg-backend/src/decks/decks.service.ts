import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Deck } from './entities/deck.entity';
import { Card } from "../cards/entities/card.entity";
import { ComparePodDto } from "./dto/compare-pod.dto";
import { CardsService } from '../cards/cards.service';

type CardEntry = {
  cardId?: string;
  card: string;
  quantity: number;
  highlighted?: boolean;
  role?: string;
  notes?: string;
};

type NestedDeckStructure = {
  main: CardEntry[];
  commanders: CardEntry[];
  sideboard?: CardEntry[];
};

@Injectable()
export class DecksService {
  constructor(
      @InjectRepository(Deck)
      private readonly deckRepository: Repository<Deck>,

      // 1. Removed direct @InjectRepository(Card) constructor parameter to resolve dependency injection collision
      private readonly cardsService: CardsService,
  ) {}

  async checkCardsInDeck(
      deckStructure: NestedDeckStructure,
      infiniteCombos: any = []
  ): Promise<{
    bracket: number;
    tags: string[];
    gamechangerCount: number;
    tutorCount: number;
    fastManaCount: number;
  }> {

    const deckstats = {
      gamechangers: 0,
      fastmana: 0,
      tutors: 0,
      combos: Array.isArray(infiniteCombos)
          ? infiniteCombos.length
          : infiniteCombos ? Object.keys(infiniteCombos).length : 0,
      isBanned: false
    };

    const quantityMap = new Map<string, number>();

    const processEntries = (entries: CardEntry[]) => {
      if (!entries) return;
      for (const entry of entries) {
        if (entry?.card) {
          const qty = entry.quantity || 1;
          quantityMap.set(entry.card, (quantityMap.get(entry.card) || 0) + qty);
        }
      }
    };

    processEntries(deckStructure?.commanders || []);
    processEntries(deckStructure?.main || []);
    processEntries(deckStructure?.sideboard || []);

    const allCardNames = Array.from(quantityMap.keys());

    if (allCardNames.length === 0) {
      return {
        bracket: 1,
        tags: [],
        gamechangerCount: 0,
        tutorCount: 0,
        fastManaCount: 0
      };
    }

    // 2. Safely call the repository lookup proxy method via cardsService to load full records mapping
    const cardsInDb = await this.cardsService.findByNames(allCardNames);

    const tagCounts = new Map<string, number>();
    const subtypeCounts = new Map<string, number>();

    for (const card of cardsInDb) {
      const cardQty = quantityMap.get(card.name) || 1;

      const tagsArray = Array.isArray(card.tags)
          ? card.tags
          : (card.tags as unknown as string) ? (card.tags as unknown as string).split(',') : [];

      tagsArray.forEach(rawTag => {
        if (rawTag) {
          const tag = rawTag.trim();
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + cardQty);
        }
      });

      if (card.type && card.type.includes('—')) {
        const [, subtypesPart] = card.type.split('—');
        const subtypes = subtypesPart.trim().split(/\s+/);

        subtypes.forEach(subtype => {
          const cleanSubtype = subtype.trim();
          if (cleanSubtype) {
            subtypeCounts.set(cleanSubtype, (subtypeCounts.get(cleanSubtype) || 0) + cardQty);
          }
        });
      }

      if (card.isGamechanger) {
        deckstats.gamechangers += cardQty;
      }

      if (tagsArray.includes('Fast Mana')) {
        deckstats.fastmana += cardQty;
      }

      if (tagsArray.includes('Tutor')) {
        deckstats.tutors += cardQty;
      }

      const hasBannedTag = tagsArray.some(tag => tag.toLowerCase() === 'banned');
      if (hasBannedTag) {
        deckstats.isBanned = true;
      }
    }

    const TRIBAL_THRESHOLD = 15;

    subtypeCounts.forEach((count, subtype) => {
      if (count >= TRIBAL_THRESHOLD) {
        tagCounts.set(`${subtype} Tribal`, count * 1.5);
      }
    });

    const topThreeTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, 3);

    let finalBracket = 1;

    if (deckstats.isBanned) {
      finalBracket = 5;
    } else if ((deckstats.combos >= 2 && deckstats.fastmana >= 3 && deckstats.tutors >= 4) ||
        (deckstats.gamechangers >= 5 || deckstats.fastmana >= 5)) {
      finalBracket = 4;
    } else if (deckstats.combos > 0 || deckstats.gamechangers > 0 || deckstats.tutors > 3) {
      finalBracket = 3;
    } else if (deckstats.combos === 0 && deckstats.gamechangers === 0 && deckstats.tutors <= 3) {
      if (deckstats.fastmana > 1) {
        finalBracket = 3;
      } else {
        finalBracket = 2;
      }
    }

    return {
      bracket: finalBracket,
      tags: topThreeTags,
      gamechangerCount: deckstats.gamechangers,
      tutorCount: deckstats.tutors,
      fastManaCount: deckstats.fastmana
    };
  }

  async comparePod(comparePodDto: ComparePodDto) {
    const { deckNames } = comparePodDto;

    if (!deckNames || deckNames.length !== 4) {
      throw new Error('A pod must consist of exactly 4 decks.');
    }

    const decks = await this.deckRepository.find({
      where: deckNames.map(name => ({ name: ILike(name.trim()) }))
    });

    if (decks.length !== 4) {
      const foundNames = decks.map(d => d.name.toLowerCase());
      const missing = deckNames.filter(name => !foundNames.includes(name.toLowerCase()));
      throw new NotFoundException(`Could not match all decks. Missing: ${missing.join(', ')}`);
    }

    const sortedDecksByPower = [...decks].sort((a, b) => {
      if (b.bracket !== a.bracket) return b.bracket - a.bracket;

      const powerA = a.gamechangerCount + a.fastManaCount + a.tutorCount;
      const powerB = b.gamechangerCount + b.fastManaCount + b.tutorCount;
      return powerB - powerA;
    });

    const strongestDeck = sortedDecksByPower[0];
    const weakestDeck = sortedDecksByPower[3];

    const warnings: string[] = [];
    let bracketDisparity = strongestDeck.bracket - weakestDeck.bracket;

    let compatibilityScore = 100;

    if (bracketDisparity >= 1) {
      compatibilityScore -= (bracketDisparity * 20);
    }

    const averageOtherGamechangers = (decks.reduce((acc, d) => acc + d.gamechangerCount, 0) - strongestDeck.gamechangerCount) / 3;
    if (strongestDeck.gamechangerCount > averageOtherGamechangers + 3) {
      warnings.push(`"${strongestDeck.name}" contains significantly more game-changers than the rest of the pod.`);
      compatibilityScore -= 10;
    }

    const averageOtherFastMana = (decks.reduce((acc, d) => acc + d.fastManaCount, 0) - strongestDeck.fastManaCount) / 3;
    if (strongestDeck.fastManaCount > averageOtherFastMana + 2) {
      warnings.push(`"${strongestDeck.name}" relies heavily on Fast Mana accelerants compared to peers.`);
      compatibilityScore -= 10;
    }

    const getComboCount = (deck: Deck) => Array.isArray(deck.infiniteCombos) ? deck.infiniteCombos.length : 0;
    const strongestComboCount = getComboCount(strongestDeck);
    const otherHasCombos = decks.some(d => d.id !== strongestDeck.id && getComboCount(d) > 0);

    if (strongestComboCount > 0 && !otherHasCombos) {
      warnings.push(`"${strongestDeck.name}" runs infinite combos while no other deck in the pod does.`);
      compatibilityScore -= 15;
    }

    compatibilityScore = Math.max(compatibilityScore, 20);

    let status = 'Pod is Fair';
    let statusMessage = 'The power tiers are tightly balanced. Go ahead and start the game!';

    if (compatibilityScore < 85 && compatibilityScore >= 60) {
      status = 'Slight Disparity';
      statusMessage = `"${strongestDeck.name}" has an edge, but the game is still highly playable.`;
    } else if (compatibilityScore < 60) {
      status = 'Pod is not fair';
      statusMessage = `"${strongestDeck.name}" is too strong compared to the rest. Consider switching decks.`;
    }

    return {
      compatibility: `${compatibilityScore}%`,
      status,
      statusMessage,
      warnings: warnings.length > 0 ? warnings : ['No significant metric variance detected between decks.'],
      decks: decks.map(d => ({
        id: d.id,
        name: d.name,
        infinites: getComboCount(d) > 0 ? 'yes' : 'no',
        gameChangers: d.gamechangerCount > 0 ? `${d.gamechangerCount}` : 'none',
        bracket: String(d.bracket),
        interaction: d.tutorCount >= 4 ? 'high' : d.tutorCount >= 2 ? 'medium' : 'low',
        tutors: d.tutorCount > 0 ? `${d.tutorCount}` : 'none',
        tags: d.tags,
        isOutlier: d.id === strongestDeck.id && compatibilityScore < 85
      }))
    };
  }

  async create(createDeckDto: CreateDeckDto): Promise<Deck> {
    const deck = this.deckRepository.create(createDeckDto);
    const deckStructure = createDeckDto.deck as NestedDeckStructure;

    if (deckStructure) {
      deck.infiniteCombos = await this.checkInfiniteCombos(deckStructure);

      const {
        bracket,
        tags,
        gamechangerCount,
        tutorCount,
        fastManaCount
      } = await this.checkCardsInDeck(deckStructure, deck.infiniteCombos);

      deck.bracket = bracket;
      deck.tags = tags;
      deck.gamechangerCount = gamechangerCount;
      deck.tutorCount = tutorCount;
      deck.fastManaCount = fastManaCount;
    }

    return await this.deckRepository.save(deck);
  }

  async update(id: string, updateDeckDto: UpdateDeckDto): Promise<Deck> {
    const deck = await this.deckRepository.findOne({ where: { id } });
    if (!deck) {
      throw new NotFoundException(`Deck with ID ${id} not found`);
    }
    const updatedDeck = this.deckRepository.merge(deck, updateDeckDto);

    if (updateDeckDto.deck) {
      const deckStructure = updateDeckDto.deck as NestedDeckStructure;
      updatedDeck.infiniteCombos = await this.checkInfiniteCombos(deckStructure);

      const {
        bracket,
        tags,
        gamechangerCount,
        tutorCount,
        fastManaCount
      } = await this.checkCardsInDeck(deckStructure, updatedDeck.infiniteCombos);

      updatedDeck.bracket = bracket;
      updatedDeck.tags = tags;
      updatedDeck.gamechangerCount = gamechangerCount;
      updatedDeck.tutorCount = tutorCount;
      updatedDeck.fastManaCount = fastManaCount;
    }

    return await this.deckRepository.save(updatedDeck);
  }

  async findAll(): Promise<Deck[]> {
    return await this.deckRepository.find();
  }

  async findOne(id: string): Promise<any> {
    const deck = await this.deckRepository.findOne({ where: { id } });
    if (!deck) {
      throw new NotFoundException(`Deck with ID ${id} not found`);
    }

    const commanderName = deck.deck?.commanders?.[0]?.card;
    let commanderDetails: Card | null = null;

    if (commanderName) {
      try {
        commanderDetails = await this.cardsService.findOne(commanderName);
      } catch (error) {
        console.warn(`Could not find commander card details for: ${commanderName}`);
      }
    }

    return {
      ...deck,
      commanderCard: commanderDetails,
    };
  }

  async remove(id: string): Promise<void> {
    const result = await this.deckRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Deck with ID ${id} not found`);
    }
  }

  async getFavoriteDecks(): Promise<Deck[]> {
    return await this.deckRepository.find({
      where: { favorite: true },
    });
  }

  public async checkInfiniteCombos(deckStructure: NestedDeckStructure): Promise<any[]> {
    try {
      if (!deckStructure) return [];

      const commanders = deckStructure.commanders?.map(c => c.card) || [];
      const mainCards = deckStructure.main?.map(c => c.card) || [];
      const sideCards = deckStructure.sideboard?.map(c => c.card) || [];

      const cardNames = Array.from(new Set([...commanders, ...mainCards, ...sideCards]));

      if (cardNames.length === 0) return [];

      const response = await fetch(
          `https://backend.commanderspellbook.com/find-my-combos?count=false`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cards: cardNames }),
          },
      );

      if (!response.ok) {
        throw new Error(`Combo microservice returned status ${response.status}`);
      }

      const data = await response.json();
      return data?.results?.included || [];
    } catch (error) {
      console.error('Failed to parse microservice combo data array:', error);
      return [];
    }
  }
}