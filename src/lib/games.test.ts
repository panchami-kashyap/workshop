import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by publisher id', async () => {
        const categoryA = await db.insert(categories).values({ name: 'Strategy', description: 'cat' }).returning({ id: categories.id });
        const categoryB = await db.insert(categories).values({ name: 'Puzzle', description: 'other' }).returning({ id: categories.id });
        const publisherA = await db.insert(publishers).values({ name: 'Pub One', description: 'pub' }).returning({ id: publishers.id });
        const publisherB = await db.insert(publishers).values({ name: 'Pub Two', description: 'pub2' }).returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'a', starRating: 4.0, categoryId: categoryA[0].id, publisherId: publisherA[0].id },
            { title: 'Bravo', description: 'b', starRating: 4.1, categoryId: categoryB[0].id, publisherId: publisherA[0].id },
            { title: 'Charlie', description: 'c', starRating: 3.4, categoryId: categoryA[0].id, publisherId: publisherB[0].id },
        ]);

        const filtered = await getAllGames(db, { publisherId: publisherA[0].id });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha', 'Bravo']);
        expect(filtered.every((game) => game.publisher?.name === 'Pub One')).toBe(true);
    });

    it('filters games by category and publisher together', async () => {
        const categoryA = await db.insert(categories).values({ name: 'Strategy', description: 'cat' }).returning({ id: categories.id });
        const categoryB = await db.insert(categories).values({ name: 'Puzzle', description: 'other' }).returning({ id: categories.id });
        const publisherA = await db.insert(publishers).values({ name: 'Pub One', description: 'pub' }).returning({ id: publishers.id });
        const publisherB = await db.insert(publishers).values({ name: 'Pub Two', description: 'pub2' }).returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'a', starRating: 4.0, categoryId: categoryA[0].id, publisherId: publisherA[0].id },
            { title: 'Bravo', description: 'b', starRating: 4.1, categoryId: categoryB[0].id, publisherId: publisherA[0].id },
            { title: 'Charlie', description: 'c', starRating: 3.4, categoryId: categoryA[0].id, publisherId: publisherB[0].id },
        ]);

        const filtered = await getAllGames(db, { publisherId: publisherA[0].id, categoryId: categoryA[0].id });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha']);
    });

    it('returns an empty list when filters match no games', async () => {
        await seedGames(db, 2);
        const filtered = await getAllGames(db, { publisherId: Number.MAX_SAFE_INTEGER });
        expect(filtered).toEqual([]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
