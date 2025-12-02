#!/usr/bin/env node
/**
 * Inspect the actual Railway PostgreSQL database schema
 * and show what tables/columns actually exist
 */

import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://postgres:kufBlJfvgFQSHCnQyUgVqwGLthMXtyot@yamanote.proxy.rlwy.net:18663/railway',
  ssl: { rejectUnauthorized: false },
});

async function inspectDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Tables in database:');
    const tables = tablesResult.rows.map(r => r.table_name);
    tables.forEach(t => console.log(`  - ${t}`));

    // For each table, get columns
    console.log('\n📊 Table structures:');
    for (const table of tables) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.log(`\n  ${table}:`);
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`    - ${col.column_name}: ${col.data_type} (${nullable})`);
      });
    }

    console.log('\n✅ Inspection complete');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

inspectDatabase();
