import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

// https://mtgjson.com/downloads/all-files/#atomiccards
// npx ts-node data/import-atomic.ts

async function importAtomic() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'magic-db',
    });
    await client.connect();

    await client.query('DROP TABLE IF EXISTS cards CASCADE;');

    console.log('Ensuring "cards" table exists...');
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS cards
        (
            name VARCHAR(255) PRIMARY KEY,
            text TEXT,
            flip_text TEXT,
            "manaCost" VARCHAR(255),
            type VARCHAR(255),
            power VARCHAR(255),
            toughness VARCHAR(255),
            colors TEXT,
            "colorIdentity" TEXT,
            tags TEXT,
            image_uri TEXT,
            "isTutor" BOOLEAN DEFAULT FALSE,
            "isGamechanger" BOOLEAN DEFAULT FALSE,
            "isStaple" BOOLEAN DEFAULT FALSE,
            "isFastMana" BOOLEAN DEFAULT FALSE,
            "isCommanderLegal" BOOLEAN DEFAULT FALSE,
            "isCommanderBanned" BOOLEAN DEFAULT FALSE
            );
    `;
    await client.query(createTableQuery);

    console.log('Reading AtomicCards.json...');
    const filePath = path.join(process.cwd(), 'data', 'AtomicCards.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(rawData);
    const cardsMap = json.data;

    console.log('Starting migration to DB...');

    let count = 0;

    for (const cardName in cardsMap) {
        const cardArray = cardsMap[cardName];

        if (!Array.isArray(cardArray) || cardArray.length === 0) {
            continue;
        }

        const card = cardArray[0];

        if (!card || !card.name) {
            continue;
        }

        let flipText: string | null = null;
        if (cardArray.length > 1 && (card.layout === 'transform' || card.layout === 'modal_dfc')) {
            flipText = cardArray[1].text || null;
        }

        let fullType = card.type || null;
        if (!fullType && (card.types || card.subtypes)) {
            const supertypesStr = card.supertypes?.length ? card.supertypes.join(' ') + ' ' : '';
            const typesStr = card.types?.join(' ') || '';
            const subtypesStr = card.subtypes?.length ? ' — ' + card.subtypes.join(' ') : '';
            fullType = `${supertypesStr}${typesStr}${subtypesStr}`.trim();
        }

        const colors = card.colors ? card.colors.join(',') : null;
        const colorIdentity = card.colorIdentity ? card.colorIdentity.join(',') : null;

        // Extracting Scryfall Oracle Id to build the static Scryfall image asset delivery URL
        let imageUri: string | null = null;
        const oracleId = card.identifiers?.scryfallOracleId;
        if (oracleId && oracleId.length >= 2) {
            const firstChar = oracleId.charAt(0);
            const secondChar = oracleId.charAt(1);
            imageUri = `https://cards.scryfall.io/normal/front/${firstChar}/${secondChar}/${oracleId}.jpg`;
        }

        const generatedTags: string[] = [];
        const textLower = (card.text || '').toLowerCase();
        const typeString = (fullType || '').toLowerCase();

        let isTutor = false;
        let isGamechanger = false;
        let isStaple = false;
        let isFastMana = false;
        let isCommanderLegal = false;
        let isCommanderBanned = false;

        if (card.legalities) {
            if (card.legalities.commander === 'Legal') {
                isCommanderLegal = true;
            }
            if (card.legalities.commander === 'Banned') {
                isCommanderBanned = true;
            }
        }

        const basicLands = ['Forest', 'Island', 'Mountain', 'Swamp', 'Plains', 'Snow-Covered Forest', 'Snow-Covered Island', 'Snow-Covered Mountain', 'Snow-Covered Swamp', 'Snow-Covered Plains'];
        const isBasicLand = basicLands.some(land => card.name.includes(land));

        if (card.edhrecRank && card.edhrecRank <= 200 && !isBasicLand) {
            isStaple = true;
        }

        if (
            textLower.includes('search your library') &&
            !textLower.includes('land') &&
            !textLower.includes('forest') &&
            !textLower.includes('mountain') &&
            !textLower.includes('island') &&
            !textLower.includes('swamp') &&
            !textLower.includes('plains')
        ) {
            isTutor = true;
        }

        const gamechangerCards = [
            "drannith magistrate", "enlightened tutor", "farewell", "humility",
            "serra's sanctum", "smothering tithe", "teferi's protection",
            "consecrated sphinx", "cyclonic rift", "fierce guardianship", "force of will",
            "gifts ungiven", "intuition", "mystical tutor", "narset, parter of veils",
            "rhystic study", "thassa's oracle",
            "ad nauseam", "bolas's citadel", "braids, cabal minion", "demonic tutor",
            "imperial seal", "necropotence", "opposition agent", "orcish bowmasters",
            "tergrid, god of fright", "vampiric tutor",
            "gamble", "jeska's will", "underworld breach",
            "biorhythm", "crop rotation", "gaea's cradle", "natural order",
            "seedborn muse", "survival of the fittest", "worldly tutor",
            "aura shards", "coalition victory", "grand arbiter augustin iv", "notion thief",
            "ancient tomb", "chrome mox", "field of the dead", "glacial chasm",
            "grim monolith", "lion's eye diamond", "mana vault", "mishra's workshop",
            "mox diamond", "panoptic mirror", "the one ring", "the tabernacle at pendrell vale"
        ];
        if (gamechangerCards.includes(card.name.toLowerCase())) {
            isGamechanger = true;
        }

        if (!typeString.includes('land')) {
            const manaValue = card.manaValue !== undefined ? card.manaValue : 0;
            const hasManaCost = card.manaCost !== undefined && card.manaCost !== null;

            const isDelayedOrTurnEngine =
                textLower.includes('at the beginning of your') ||
                textLower.includes('at the beginning of each') ||
                textLower.includes('upkeep');

            if (!isDelayedOrTurnEngine) {
                const symbolMatch = textLower.match(/add\s+((\{[wubrgc]\})+)/);
                let symbolsGeneratedCount = 0;
                if (symbolMatch) {
                    symbolsGeneratedCount = (symbolMatch[1].match(/\{[wubrgc]\}/g) || []).length;
                }

                const genericManaMatch = textLower.match(/add\s+\{(\d+)\}/);
                const genericManaGenerated = genericManaMatch ? parseInt(genericManaMatch[1], 10) : 0;

                const totalStaticManaGenerated = symbolsGeneratedCount + genericManaGenerated;

                const generatesWordedMulti = /add\s+(two|three|four|five|six)/.test(textLower);
                const generatesXOrVariable = /add.*for each|add.*equal to|add\s+\{x\}/.test(textLower);

                if (!hasManaCost || manaValue === 0) {
                    if (totalStaticManaGenerated >= 1 || textLower.includes('add one mana of any color')) {
                        isFastMana = true;
                    }
                } else if (totalStaticManaGenerated > manaValue) {
                    isFastMana = true;
                } else if (generatesWordedMulti || generatesXOrVariable) {
                    if (!textLower.includes('add one mana')) {
                        isFastMana = true;
                    }
                }
            }
        }

        // Tags checking options
        const evasionKeywords = ['flying', 'menace', 'trample', 'shadow', 'horsemanship', 'fear', 'intimidate'];
        const hasKeyword = evasionKeywords.some(keyword => textLower.includes(keyword));
        const hasPhrase = textLower.includes("can't be blocked") || textLower.includes("is unblockable");
        if (hasKeyword || hasPhrase) {
            generatedTags.push('Evasion');
        }

        if (textLower.includes('flying') || textLower.includes('trample') || textLower.includes('haste')) generatedTags.push('Aggro');
        if (textLower.includes('counter target spell') || textLower.includes("return target creature to its owner's hand")) generatedTags.push('Control');
        if (textLower.includes('spells cost') && textLower.includes('more')) generatedTags.push('Stax');
        if (textLower.includes('take an extra turn')) generatedTags.push('Extra Turn');
        if (textLower.includes('additional combat phase')) generatedTags.push('Extra Combat');
        if (textLower.includes('+1/+1 counter')) generatedTags.push('+1/+1 Counters');
        if (textLower.includes('create') && textLower.includes('token')) generatedTags.push('Tokens');
        if (textLower.includes('gain') && textLower.includes('life')) generatedTags.push('Lifegain');
        if (textLower.includes('whenever another creature dies')) generatedTags.push('Aristocrat');
        if (textLower.includes('sacrifice a') || textLower.includes('as an additional cost to cast this spell, sacrifice')) generatedTags.push('Sacrifice');
        if (textLower.endsWith('draw a card.') || textLower.includes(', draw a card.')) generatedTags.push('Cantrip');
        if (textLower.includes('return target creature card from your graveyard to the battlefield')) generatedTags.push('Reanimator');
        if (textLower.includes('search your library for a land card')) generatedTags.push('Ramp');
        if (textLower.includes('deals') && textLower.includes('damage') && (typeString.includes('instant') || typeString.includes('sorcery'))) generatedTags.push('Burn');
        if (textLower.includes('copy target instant or sorcery') || textLower.includes('copy that spell')) generatedTags.push('Spell Copy');
        if (textLower.includes('whenever a land enters the battlefield under your control')) generatedTags.push('Landfall');
        if (textLower.includes('mill') && textLower.includes('card')) generatedTags.push('Mill');
        if (textLower.includes('discard your hand, then draw')) generatedTags.push('Wheel');
        if (textLower.includes('poison counter') || textLower.includes('infect')) generatedTags.push('Infect');
        if (textLower.includes('cascade')) generatedTags.push('Cascade');
        if (textLower.includes('ninjutsu')) generatedTags.push('Ninjutsu');
        if (textLower.includes('defender')) generatedTags.push('Defender');
        if (typeString.includes('equipment') || typeString.includes('aura')) generatedTags.push('Voltron');

        if ((textLower.includes('draw a card') || textLower.includes('draws')) && !generatedTags.includes('Cantrip')) {
            generatedTags.push('Draw');
        }

        if (
            textLower.includes('landfall') ||
            textLower.includes('you may play an additional land') ||
            textLower.includes('return target land card from your graveyard') ||
            (textLower.includes('whenever a land') && textLower.includes('dies')) ||
            (typeString.includes('land') && textLower.length > 0 && !textLower.includes('add {'))
        ) {
            generatedTags.push('Lands Matter');
        }

        if (textLower.includes('treasure token')) generatedTags.push('Treasure');
        if (textLower.includes('clue token')) generatedTags.push('Clue');
        if (textLower.includes('food token')) generatedTags.push('Food');
        if (textLower.includes('blood token')) generatedTags.push('Blood');

        if (
            textLower.includes('target land becomes a creature') ||
            textLower.includes('awaken') ||
            (typeString.includes('elemental') && (typeString.includes('creature') || textLower.includes('elemental'))) ||
            textLower.includes('earthbending') ||
            textLower.includes('lands you control become')
        ) {
            generatedTags.push('Earthbending');
        }

        if (textLower.includes('exile target') && textLower.includes('return') && textLower.includes('to the battlefield under')) {
            generatedTags.push('Blink');
        }

        if (
            (textLower.includes('whenever') && textLower.includes('creature dies') && textLower.includes('lose') && textLower.includes('life')) ||
            (textLower.includes('sacrifice a creature:') || textLower.includes('sacrifice another creature:'))
        ) {
            generatedTags.push('Aristocrat');
        }

        if (
            textLower.includes('number of creature cards in your graveyard') ||
            textLower.includes('cards in your graveyard') ||
            textLower.includes('under your control from a graveyard')
        ) {
            generatedTags.push('Graveyard Matter');
        }

        if (textLower.includes('rather than pay its mana cost') || textLower.includes('without paying its mana cost')) {
            generatedTags.push('Mana Cheat');
        }

        if (
            textLower.includes('whenever an opponent') &&
            (textLower.includes('deals') || textLower.includes('deal')) &&
            textLower.includes('damage')
        ) {
            generatedTags.push('Group Slug');
        }

        if (
            (textLower.includes('destroy all') || textLower.includes('exile all') || textLower.includes('destroy each') || textLower.includes('exile each')) &&
            (textLower.includes('creature') || textLower.includes('permanent') || textLower.includes('nonland'))
        ) {
            generatedTags.push('Board Wipe');
        }

        const finalTagsString = generatedTags.length > 0
            ? Array.from(new Set(generatedTags)).join(',')
            : null;

        const query = `
            INSERT INTO cards (name, text, flip_text, type, "manaCost", power, toughness, colors, "colorIdentity", tags, image_uri,
                               "isTutor", "isGamechanger", "isStaple", "isFastMana", "isCommanderLegal",
                               "isCommanderBanned")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (name) DO UPDATE
                                          SET
                                              "manaCost" = EXCLUDED."manaCost",
                                          type = EXCLUDED.type,
                                          tags = EXCLUDED.tags,
                                          text = EXCLUDED.text,
                                          flip_text = EXCLUDED.flip_text,
                                          power = EXCLUDED.power,
                                          toughness = EXCLUDED.toughness,
                                          colors = EXCLUDED.colors,
                                          "colorIdentity" = EXCLUDED."colorIdentity",
                                          image_uri = EXCLUDED.image_uri,
                                          "isTutor" = EXCLUDED."isTutor",
                                          "isGamechanger" = EXCLUDED."isGamechanger",
                                          "isStaple" = EXCLUDED."isStaple",
                                          "isFastMana" = EXCLUDED."isFastMana",
                                          "isCommanderLegal" = EXCLUDED."isCommanderLegal",
                                          "isCommanderBanned" = EXCLUDED."isCommanderBanned";
        `;

        const values = [
            card.name,
            card.text || null,
            flipText,
            fullType,
            card.manaCost || null,
            card.power || null,
            card.toughness || null,
            colors,
            colorIdentity,
            finalTagsString,
            imageUri,
            isTutor,
            isGamechanger,
            isStaple,
            isFastMana,
            isCommanderLegal,
            isCommanderBanned
        ];

        await client.query(query, values);

        count++;
        if (count % 5000 === 0) {
            console.log(`Processed ${count} cards...`);
        }
    }

    console.log(`\n🎉 Success! Finished importing ${count} Atomic cards perfectly with Scryfall Image URIs.`);
    await client.end();
}

importAtomic().catch(err => console.error(err));