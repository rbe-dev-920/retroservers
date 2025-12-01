#!/usr/bin/env node
// Recover data from Railway PostgreSQL

import pkg from 'pg';
const { Client } = pkg;

async function recoverData() {
  // Hard-code the Postgres connection (from test-postgres.js)
  const connectionString = 'postgresql://postgres:kufBlJfvgFQSHCnQyUgVqwGLthMXtyot@yamanote.proxy.rlwy.net:18663/railway';
  
  console.log('🔍 Connecting to PostgreSQL...');
  
  const client = new Client({
    host: 'yamanote.proxy.rlwy.net',
    port: 18663,
    user: 'postgres',
    password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
    database: 'railway',
    ssl: false  // Try without SSL first
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    // First, list all tables
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log(`\n📊 Available tables (${tables.rows.length}):`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));
    
    if (tables.rows.length === 0) {
      console.log('⚠️  No tables found in public schema. Database might be empty.');
      await client.end();
      return;
    }
    
    // Try to recover data from available tables
    console.log('\n📊 Retrieving data from database...\n');
    
    // Members/Users
    const members = await client.query(`
      SELECT id, email, "firstName", "lastName", status, "createdAt", "updatedAt"
      FROM "Member"
      ORDER BY "createdAt" DESC
    `).catch(() => ({ rows: [] }));
    console.log(`👥 Members (${members.rows.length}):`);
    if (members.rows.length > 0) console.table(members.rows);
    
    // Events
    const events = await client.query(`
      SELECT id, title, description, date, status, "createdAt", "updatedAt"
      FROM "Event"
      ORDER BY "createdAt" DESC
    `).catch(() => ({ rows: [] }));
    console.log(`\n📅 Events (${events.rows.length}):`);
    if (events.rows.length > 0) console.table(events.rows);
    
    // Transactions
    const transactions = await client.query(`
      SELECT id, type, amount, description, category, date, "eventId", "createdAt"
      FROM "Transaction"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));
    console.log(`\n💰 Transactions (${transactions.rows.length}):`);
    if (transactions.rows.length > 0) console.table(transactions.rows);
    
    // Documents
    const documents = await client.query(`
      SELECT id, type, status, "expiresAt", "memberId", "createdAt"
      FROM "Document"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));
    console.log(`\n📄 Documents (${documents.rows.length}):`);
    if (documents.rows.length > 0) console.table(documents.rows);
    
    // ExpenseReports
    const expenseReports = await client.query(`
      SELECT id, date, description, amount, status, "memberId", "eventId", "createdAt"
      FROM "ExpenseReport"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));
    console.log(`\n📋 Expense Reports (${expenseReports.rows.length}):`);
    if (expenseReports.rows.length > 0) console.table(expenseReports.rows);
    
    // ScheduledExpense
    const scheduledExpense = await client.query(`
      SELECT id, type, amount, description, category, "dueDate", recurring, "eventId", "createdAt"
      FROM "ScheduledExpense"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));
    console.log(`\n📆 Scheduled Expenses (${scheduledExpense.rows.length}):`);
    if (scheduledExpense.rows.length > 0) console.table(scheduledExpense.rows);
    
    console.log('\n✅ Data recovery complete!');
    
    // Export data as JSON for recovery
    const exportData = {
      timestamp: new Date().toISOString(),
      tables: {
        members: members.rows,
        events: events.rows,
        transactions: transactions.rows,
        documents: documents.rows,
        expenseReports: expenseReports.rows,
        scheduledExpense: scheduledExpense.rows
      }
    };
    
    console.log('\n💾 Exported data structure ready for API initialization...');
    
    await client.end();
    return exportData;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

await recoverData();
