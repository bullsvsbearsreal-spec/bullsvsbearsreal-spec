/**
 * Initialize the database schema.
 *
 * Usage:
 *   npx tsx scripts/init-db.ts
 *
 * Requires POSTGRES_URL or DATABASE_URL in .env.local or environment.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initDB } from '../src/lib/db';

async function main() {
  console.log('Initializing database...');
  console.log('URL:', process.env.POSTGRES_URL?.slice(0, 30) + '...' || process.env.DATABASE_URL?.slice(0, 30) + '...' || 'NOT SET');

  try {
    await initDB();
    console.log('Database initialized successfully! Tables created:');
    console.log('  - api_cache');
    console.log('  - funding_snapshots');
    console.log('  - oi_snapshots');
    console.log('  - watchlists');
    console.log('  - user_prefs');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
