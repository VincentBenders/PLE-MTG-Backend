
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

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
    CREATE TABLE IF NOT EXISTS cards (
      name VARCHAR(255) PRIMARY KEY,
      text TEXT,
      "manaCost" VARCHAR(255),
      type VARCHAR(255),
      power VARCHAR(255),
      toughness VARCHAR(255),
      colors TEXT,
      "colorIdentity" TEXT
    );
  `;
    await client.query(createTableQuery);

    console.log('Reading AtomicCards.json...');
    const filePath = path.join(__dirname, 'AtomicCards.json');
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

        const colors = card.colors ? card.colors.join(',') : null;
        const colorIdentity = card.colorIdentity ? card.colorIdentity.join(',') : null;

        const query = `
      INSERT INTO cards (name, text, "manaCost", type, power, toughness, colors, "colorIdentity")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name) DO NOTHING;
    `;

        const values = [
            card.name,
            card.text || null,
            card.manaCost || null,
            card.type || null,
            card.power || null,
            card.toughness || null,
            colors,
            colorIdentity
        ];

        await client.query(query, values);

        count++;
        if (count % 5000 === 0) {
            console.log(`Processed ${count} cards...`);
        }
    }

    console.log(`\n🎉 Success! Finished importing ${count} Atomic cards perfectly.`);
    await client.end();
}

importAtomic().catch(err => console.error(err));
