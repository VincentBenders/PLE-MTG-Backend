import {Injectable, NotFoundException} from '@nestjs/common';
import {CreateDeckDto} from './dto/create-deck.dto';
import {UpdateDeckDto} from './dto/update-deck.dto';
import {InjectRepository} from '@nestjs/typeorm';
import {ILike, In, Repository} from 'typeorm';
import {Deck} from './entities/deck.entity';
import {Card} from "../cards/entities/card.entity";
import {ComparePodDto} from "./dto/compare-pod.dto";
import {CardsService} from '../cards/cards.service';

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
        private readonly cardsService: CardsService,
    ) {
    }

    async checkCardsInDeck(
        deckStructure: NestedDeckStructure,
        infiniteCombos: any = []
    ): Promise<{
        bracket: number;
        tags: string[];
        gamechangerCount: number;
        tutorCount: number;
        fastManaCount: number;
        stapleCount: number;
    }> {

        const deckstats = {
            gamechangers: 0,
            fastmana: 0,
            tutors: 0,
            staples: 0,
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
                fastManaCount: 0,
                stapleCount: 0
            };
        }

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

            if (card.isStaple) {
                deckstats.staples += cardQty;
            }

            if (card.isFastMana) {
                deckstats.fastmana += cardQty;
            }

            if (card.isTutor) {
                deckstats.tutors += cardQty;
            }

            const hasBannedTag = tagsArray.some(tag => tag.toLowerCase() === 'banned');
            if (hasBannedTag || card.isCommanderBanned) {
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



        return {
            bracket: this.calculateBracket(deckstats),
            tags: topThreeTags,
            gamechangerCount: deckstats.gamechangers,
            tutorCount: deckstats.tutors,
            fastManaCount: deckstats.fastmana,
            stapleCount: deckstats.staples
        };
    }

    async comparePod(comparePodDto: ComparePodDto) {
        const { deckIds } = comparePodDto;

        if (!deckIds || deckIds.length !== 4) {
            throw new Error('A pod must consist of exactly 4 decks.');
        }

        const decks = await this.deckRepository.find({
            where: deckIds.map(deckId => ({ id: deckId }))
        });

        if (decks.length != 4) {
            const foundNames = decks.map(d => d.name.toLowerCase());
            const missing = deckIds.filter(name => !foundNames.includes(name.toLowerCase()));
            throw new NotFoundException(`Could not match all decks. Missing: ${missing.join(', ')}`);
        }

        const getComboCount = (deck: Deck) =>
            Array.isArray(deck.infiniteCombos) ? deck.infiniteCombos.length : 0;

        const getPowerScore = (deck: Deck) =>
            getComboCount(deck) * 4 +
            deck.gamechangerCount * 3 +
            deck.fastManaCount * 2 +
            deck.tutorCount;

        const scoredDecks = decks.map(deck => ({
            deck,
            powerScore: getPowerScore(deck),
            comboCount: getComboCount(deck),
        }));

        const brackets = decks.map(d => d.bracket);
        const maxBracket = Math.max(...brackets);
        const minBracket = Math.min(...brackets);
        const bracketDisparity = maxBracket - minBracket;

        const scores = scoredDecks.map(s => s.powerScore);
        const avgScore = scores.reduce((a, b) => a + b, 0) / 4;

        const strongest = [...scoredDecks].sort((a, b) => {
            if (b.deck.bracket !== a.deck.bracket) return b.deck.bracket - a.deck.bracket;
            return b.powerScore - a.powerScore;
        })[0];

        const weakest = [...scoredDecks].sort((a, b) => {
            if (a.deck.bracket !== b.deck.bracket) return a.deck.bracket - b.deck.bracket;
            return a.powerScore - b.powerScore;
        })[0];

        const warnings: string[] = [];
        let compatibilityScore = 100;

        if (bracketDisparity >= 3) {
            compatibilityScore -= 40;
        } else if (bracketDisparity >= 2) {
            compatibilityScore -= 25;
        } else if (bracketDisparity === 1) {
            compatibilityScore -= 10;
        }

        for (const { deck, powerScore } of scoredDecks) {
            if (avgScore > 0 && powerScore > avgScore * 1.75) {
                warnings.push(`"${deck.name}" is significantly stronger than the pod average.`);
                compatibilityScore -= 10;
            } else if (avgScore > 0 && powerScore < avgScore * 0.3 && avgScore >= 4) {
                warnings.push(`"${deck.name}" may be too weak for this pod.`);
                compatibilityScore -= 5;
            }
        }

        const decksWithCombos = scoredDecks.filter(s => s.comboCount > 0);
        if (decksWithCombos.length === 1) {
            warnings.push(`Only "${decksWithCombos[0].deck.name}" runs infinite combos — significant asymmetry.`);
            compatibilityScore -= 15;
        } else if (decksWithCombos.length === 2) {
            const names = decksWithCombos.map(s => `"${s.deck.name}"`).join(' and ');
            warnings.push(`${names} run infinite combos while the other two decks don't.`);
            compatibilityScore -= 8;
        }

        const avgGC = decks.reduce((acc, d) => acc + d.gamechangerCount, 0) / 4;
        for (const deck of decks) {
            if (deck.gamechangerCount > avgGC + 3) {
                warnings.push(`"${deck.name}" has significantly more game changers than the rest of the pod.`);
                compatibilityScore -= 8;
            }
        }

        const avgFM = decks.reduce((acc, d) => acc + d.fastManaCount, 0) / 4;
        for (const deck of decks) {
            if (deck.fastManaCount > avgFM + 2) {
                warnings.push(`"${deck.name}" has significantly more fast mana than the rest of the pod.`);
                compatibilityScore -= 8;
            }
        }

        compatibilityScore = Math.max(compatibilityScore, 10);

        let status: string;
        let statusMessage: string;

        if (compatibilityScore >= 85) {
            status = 'Fair Pod';
            statusMessage = 'Power levels are well balanced. Go ahead and play!';
        } else if (compatibilityScore >= 65) {
            status = 'Slight Disparity';
            statusMessage = `"${strongest.deck.name}" has an edge, but the game is still playable.`;
        } else if (compatibilityScore >= 40) {
            status = 'Notable Imbalance';
            statusMessage = `There's a meaningful gap between "${strongest.deck.name}" and "${weakest.deck.name}". Consider swapping a deck.`;
        } else {
            status = 'Unfair Pod';
            statusMessage = `"${strongest.deck.name}" is too powerful for this pod. Strongly consider switching decks.`;
        }

        return {
            compatibility: `${compatibilityScore}%`,
            status,
            statusMessage,
            warnings: warnings.length > 0 ? warnings : ['No significant variance detected — looks like a fair pod!'],
            decks: scoredDecks.map(({ deck, powerScore, comboCount }) => ({
                id: deck.id,
                name: deck.name,
                bracket: deck.bracket,
                powerScore,
                infinites: comboCount > 0 ? comboCount : 'none',
                gameChangers: deck.gamechangerCount || 'none',
                fastMana: deck.fastManaCount || 'none',
                tutors: deck.tutorCount || 'none',
                tags: deck.tags,
                isOutlier: powerScore > avgScore * 1.75 || (deck.bracket === maxBracket && bracketDisparity >= 2),
            }))
        };
    }

    async create(createDeckDto: CreateDeckDto): Promise<Deck> {

        const hasNestedDeck = 'deck' in createDeckDto && (createDeckDto as any).deck;

        const deckStructure: NestedDeckStructure = hasNestedDeck
            ? (createDeckDto as any).deck
            : createDeckDto;

        const name = (createDeckDto as any).name || 'Untitled Deck';
        const favorite = (createDeckDto as any).favorite || false;

        const deck = this.deckRepository.create({
            name,
            favorite,
            deck: deckStructure
        });

        if (deckStructure && (Array.isArray(deckStructure.main) || Array.isArray(deckStructure.commanders))) {
            deck.infiniteCombos = await this.checkInfiniteCombos(deckStructure);

            const {
                bracket,
                tags,
                gamechangerCount,
                tutorCount,
                fastManaCount,
                stapleCount
            } = await this.checkCardsInDeck(deckStructure, deck.infiniteCombos);

            deck.bracket = bracket;
            deck.tags = tags;
            deck.gamechangerCount = gamechangerCount;
            deck.tutorCount = tutorCount;
            deck.fastManaCount = fastManaCount;
            deck.stapleCount = stapleCount;
        }

        return await this.deckRepository.save(deck);
    }

    async update(id: string, updateDeckDto: UpdateDeckDto): Promise<Deck> {
        const deck = await this.deckRepository.findOne({where: {id}});
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
                fastManaCount,
                stapleCount
            } = await this.checkCardsInDeck(deckStructure, updatedDeck.infiniteCombos);

            updatedDeck.bracket = bracket;
            updatedDeck.tags = tags;
            updatedDeck.gamechangerCount = gamechangerCount;
            updatedDeck.tutorCount = tutorCount;
            updatedDeck.fastManaCount = fastManaCount;
            updatedDeck.stapleCount = stapleCount;
        }

        return await this.deckRepository.save(updatedDeck);
    }

    async findAll(): Promise<Deck[]> {
        return await this.deckRepository.find();
    }

    async findOne(id: string): Promise<any> {
        const deckEntity = await this.deckRepository.findOne({where: {id}});
        if (!deckEntity) {
            throw new NotFoundException(`Deck with ID ${id} not found`);
        }

        const deck = {...deckEntity};

        const cardNamesSet = new Set<string>();
        deck.deck?.main?.forEach(entry => {
            if (entry.card) cardNamesSet.add(entry.card);
        });
        deck.deck?.commanders?.forEach(entry => {
            if (entry.card) cardNamesSet.add(entry.card);
        });
        deck.deck?.sideboard?.forEach(entry => {
            if (entry.card) cardNamesSet.add(entry.card);
        });

        const uniqueCardNames = Array.from(cardNamesSet);

        let cardDetailsMap = new Map<string, any>();
        if (uniqueCardNames.length > 0) {
            try {
                const cards = await this.cardsService.findByNames(uniqueCardNames);
                cardDetailsMap = new Map(cards.map(card => [card.name, card]));
            } catch (error) {
                console.warn('Could not batch fetch card details', error);
            }
        }

        let gamechangerCount = 0;
        let tutorCount = 0;
        let fastManaCount = 0;
        let stapleCount = 0;

        const enrichCardEntries = (entries: any[] = []) => {
            return entries.map(entry => {
                const details = cardDetailsMap.get(entry.card) || null;

                if (details) {
                    const qty = entry.quantity || 1;
                    if (details.isGamechanger) gamechangerCount += qty;
                    if (details.isTutor) tutorCount += qty;
                    if (details.isFastMana) fastManaCount += qty;
                    if (details.isStaple) stapleCount += qty;
                }

                return {
                    ...entry,
                    details
                };
            });
        };

        const updatedDeckStructure = {...deck.deck};

        if (deck.deck) {
            updatedDeckStructure.main = enrichCardEntries(deck.deck.main);
            updatedDeckStructure.commanders = enrichCardEntries(deck.deck.commanders);
            if (deck.deck.sideboard) {
                updatedDeckStructure.sideboard = enrichCardEntries(deck.deck.sideboard);
            }
        }

        const firstCommanderName = deck.deck?.commanders?.[0]?.card;
        const commanderCard = firstCommanderName ? cardDetailsMap.get(firstCommanderName) : null;

        return {
            ...deck,
            deck: updatedDeckStructure,
            commanderCard,
            gamechangerCount,
            tutorCount,
            fastManaCount,
            stapleCount
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
            where: {favorite: true},
        });
    }

    public async checkInfiniteCombos(deckStructure: NestedDeckStructure): Promise<any[]> {
        try {
            if (!deckStructure) return [];

            const commanders = deckStructure.commanders?.map(c => c.card) || [];
            const mainCards  = deckStructure.main?.map(c => c.card)       || [];
            const sideCards  = deckStructure.sideboard?.map(c => c.card)  || [];

            const commanderLines = commanders.map(name => `1 ${name} *CMDR*`);
            const mainLines      = Array.from(new Set([...mainCards, ...sideCards]))
                .map(name => `1 ${name}`);

            const decklist = [...commanderLines, ...mainLines].join('\n');
            if (!decklist) return [];

            const response = await fetch(
                `https://backend.commanderspellbook.com/find-my-combos?count=false`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'text/plain',
                    },
                    body: decklist,
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

    public calculateBracket(deckstats: {
        isBanned: boolean;
        combos: number;
        fastmana: number;
        tutors: number;
        gamechangers: number;
    }): number {
        const { isBanned, combos, fastmana, tutors, gamechangers } = deckstats;

        // Bracket 5 banned cards
        if (isBanned) return 5;

        // Bracket 4 cEDH with banlist
        if (
            gamechangers >= 4 ||
            combos >= 2 ||
            (combos >= 1 && tutors >= 3) ||
            (combos >= 1 && fastmana >= 3) ||
            (fastmana >= 4 && tutors >= 3)
        ) return 4;

        // Bracket 3 focused with restrictions (yes precons with gamechangers and or combos are in here)
        if (
            gamechangers >= 2 ||
            combos >= 1 ||
            tutors >= 3 ||
            (gamechangers >= 1 && fastmana >= 2) ||
            (gamechangers >= 1 && tutors >= 2)
        ) return 3;
        // precon lvl
        return 2;
    }
}