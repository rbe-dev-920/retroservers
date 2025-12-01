#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway',
  ssl: false
});

await client.connect();

const res = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'members' 
  ORDER BY ordinal_position
`);

console.log('Members table columns:');
res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

// Also get first few rows
const data = await client.query('SELECT * FROM members LIMIT 3');
console.log('\nFirst 3 members:');
console.table(data.rows);

await client.end();
