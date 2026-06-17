import * as fs from 'fs';
import * as path from 'path';
import {Client} from 'pg';

// https://mtgjson.com/downloads/all-files/#atomiccards

async function importAtomic() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'magic-db',
    });
    await client.connect();

    console.log('Ensuring "cards" table exists...');
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS cards
        (
            name
            VARCHAR
        (
            255
        ) PRIMARY KEY,
            text TEXT,
            "manaCost" VARCHAR
        (
            255
        ),
            type VARCHAR
        (
            255
        ),
            power VARCHAR
        (
            255
        ),
            toughness VARCHAR
        (
            255
        ),
            colors TEXT,
            "colorIdentity" TEXT,
            tags TEXT,
            "isGamechanger" BOOLEAN DEFAULT FALSE,
            "isStaple" BOOLEAN DEFAULT FALSE
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

        let fullType = card.type || null;
        if (!fullType && (card.types || card.subtypes)) {
            const supertypesStr = card.supertypes?.length ? card.supertypes.join(' ') + ' ' : '';
            const typesStr = card.types?.join(' ') || '';
            const subtypesStr = card.subtypes?.length ? ' — ' + card.subtypes.join(' ') : '';
            fullType = `${supertypesStr}${typesStr}${subtypesStr}`.trim();
        }

        const colors = card.colors ? card.colors.join(',') : null;
        const colorIdentity = card.colorIdentity ? card.colorIdentity.join(',') : null;

        const generatedTags: string[] = [];
        const textLower = (card.text || '').toLowerCase();
        const typeString = (fullType || '').toLowerCase();

        //fast mana check
        // checks for: "add {w}{w}", etc.
        const generatesDoubleColoredOrColorless = /add \{(w|u|b|r|g|c)\}\{(w|u|b|r|g|c)\}/.test(textLower);

        const generatesTwoPlusGeneric = /add \{[2-9]\}/.test(textLower);

        const generatesWordedMultiMana = /add (two|three|four|five|six)/.test(textLower);

        const cleanManaCost = (card.manaCost || '').replace(/[\{\}]/g, '');
        const genericMatch = cleanManaCost.match(/\d+/);
        const genericValue = genericMatch ? parseInt(genericMatch[0], 10) : 0;
        const coloredSymbolsCount = cleanManaCost.replace(/\d+/g, '').length;
        const manaValue = genericValue + coloredSymbolsCount;

        const addsAnyMana = textLower.includes('add ') || textLower.includes('add {');

        if (addsAnyMana) {
            //for lotus petal stuffs
            if (card.manaCost === undefined || card.manaCost === null || manaValue === 0) {
                // check for not standard lands
                if (!typeString.includes('land')) {
                    generatedTags.push('Fast Mana');
                }
            }
            // for sol ring, dark ritual, etc.
            else if (generatesDoubleColoredOrColorless || generatesTwoPlusGeneric || generatesWordedMultiMana) {
                if (!textLower.includes('add one mana of any color')) {
                    generatedTags.push('Fast Mana');
                }
            }
            // for things like jeska's will
            else if (textLower.includes('add') && textLower.includes('for each')) {
                generatedTags.push('Fast Mana');
            }
        }
        // tags checking
        if (textLower.includes('flying')) generatedTags.push('Fast Mana');
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
        if (textLower.includes('search your library') && !textLower.includes('land') && !textLower.includes('forest') && !textLower.includes('mountain') && !textLower.includes('island') && !textLower.includes('swamp') && !textLower.includes('plains')) generatedTags.push('Tutor');
        if (textLower.includes('search your library for a land card')) generatedTags.push('Ramp');
        if (textLower.includes('treasure token')) generatedTags.push('Treasure');
        if (textLower.includes('clue token')) generatedTags.push('Clue');
        if (textLower.includes('deals') && textLower.includes('damage') && (typeString.includes('instant') || typeString.includes('sorcery'))) generatedTags.push('Burn');
        if (textLower.includes('copy target instant or sorcery') || textLower.includes('copy that spell')) generatedTags.push('Spell Copy');
        if (textLower.includes('whenever a land enters the battlefield under your control')) generatedTags.push('Landfall');
        if (textLower.includes('mill') && textLower.includes('card')) generatedTags.push('Mill');
        if (textLower.includes('discard your hand, then draw')) generatedTags.push('Wheel');
        if (textLower.includes('draw a card') || textLower.includes('draws')) generatedTags.push('Draw');
        if (textLower.includes('poison counter') || textLower.includes('infect')) generatedTags.push('Infect');
        if (textLower.includes('cascade')) generatedTags.push('Cascade');
        if (textLower.includes('ninjutsu')) generatedTags.push('Ninjutsu');
        if (textLower.includes('defender')) generatedTags.push('Defender');
        if (typeString.includes('equipment') || typeString.includes('aura')) generatedTags.push('Voltron');
        if (
            textLower.includes('landfall') ||
            textLower.includes('you may play an additional land') ||
            textLower.includes('return target land card from your graveyard') ||
            (textLower.includes('whenever a land') && textLower.includes('dies')) ||
            (typeString.includes('land') && textLower.length > 0 && !textLower.includes('add {'))
        ) {
            generatedTags.push('Lands Matter');
        }
        if (
            textLower.includes('target land becomes a creature') ||
            textLower.includes('awaken') || // The mechanic that turns lands into elementals
            (typeString.includes('elemental') && (typeString.includes('creature') || textLower.includes('elemental'))) ||
            textLower.includes('earthbending') ||
            textLower.includes('lands you control become')
        ) {
            generatedTags.push('Earthbending');
        }

        const finalTagsString = generatedTags.length > 0
            ? Array.from(new Set(generatedTags)).join(',')
            : null;

        const isGamechangerValue = card.isFunny || false;

        const query = `
            INSERT INTO cards (name, text, type, "manaCost", power, toughness, colors, "colorIdentity", tags,
                               "isGamechanger")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (name) DO
            UPDATE
                SET
                    "manaCost" = EXCLUDED."manaCost",
                type = EXCLUDED.type,
                tags = EXCLUDED.tags,
                text = EXCLUDED.text,
                power = EXCLUDED.power,
                toughness = EXCLUDED.toughness,
                colors = EXCLUDED.colors,
                "colorIdentity" = EXCLUDED."colorIdentity";
        `;

        const values = [
            card.name,
            card.text || null,
            fullType,
            card.manaCost || null,
            card.power || null,
            card.toughness || null,
            colors,
            colorIdentity,
            finalTagsString,
            isGamechangerValue
        ];

        await client.query(query, values);

        count++;
        if (count % 5000 === 0) {
            console.log(`Processed ${count} cards...`);
        }
    }

    console.log(`\n🎉 Success! Finished importing ${count} Atomic cards perfectly with tag populations.`);
    await client.end();
}

importAtomic().catch(err => console.error(err));