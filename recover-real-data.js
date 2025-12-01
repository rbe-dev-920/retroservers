#!/usr/bin/env node
// Recover real data from Railway PostgreSQL

import pkg from 'pg';
const { Client } = pkg;

async function recoverRealData() {
  console.log('🔍 Connecting to PostgreSQL...');
  
  const client = new Client({
    host: 'yamanote.proxy.rlwy.net',
    port: 18663,
    user: 'postgres',
    password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
    database: 'railway',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!\n');
    
    // Members
    const members = await client.query(`
      SELECT id, email, "firstName", "lastName", role, status, "createdAt"
      FROM members
      ORDER BY "createdAt" DESC
      LIMIT 50
    `);
    console.log(`👥 Members (${members.rows.length}):`);
    members.rows.forEach(m => {
      console.log(`   - ${m.email} (${m.firstName} ${m.lastName}) - ${m.role}`);
    });
    
    // Vehicles
    const vehicles = await client.query(`
      SELECT id, "parkingNumber", brand, model, "registrationNumber", status, "fuelLevel"
      FROM "Vehicle"
      ORDER BY "createdAt" DESC
      LIMIT 50
    `);
    console.log(`\n🚌 Vehicles (${vehicles.rows.length}):`);
    vehicles.rows.forEach(v => {
      console.log(`   - ${v.parkingNumber} (${v.brand} ${v.model}) - ${v.status}`);
    });
    
    // Usages
    const usages = await client.query(`
      SELECT id, "vehicleId", "driverId", "startedAt", "endedAt", "totalKm", "note"
      FROM "Usage"
      ORDER BY "startedAt" DESC
      LIMIT 50
    `);
    console.log(`\n📊 Usages (${usages.rows.length}):`);
    usages.rows.forEach(u => {
      console.log(`   - ${u.id.substring(0, 8)}... (${u.startedAt})`);
    });
    
    // Finance Transactions
    const transactions = await client.query(`
      SELECT id, type, amount, "description", "date", category
      FROM finance_transactions
      ORDER BY "date" DESC
      LIMIT 50
    `);
    console.log(`\n💰 Transactions (${transactions.rows.length}):`);
    transactions.rows.forEach(t => {
      console.log(`   - ${t.type} ${t.amount}€ - ${t.description}`);
    });
    
    // Newsletter Subscribers
    const subscribers = await client.query(`
      SELECT id, email, status, "subscribedAt"
      FROM "NewsletterSubscriber"
      ORDER BY "subscribedAt" DESC
      LIMIT 50
    `);
    console.log(`\n📧 Newsletter Subscribers (${subscribers.rows.length}):`);
    subscribers.rows.forEach(s => {
      console.log(`   - ${s.email} - ${s.status}`);
    });
    
    // Retro Requests
    const retroRequests = await client.query(`
      SELECT id, "requestNumber", status, "requestDate", "createdAt"
      FROM retro_request
      ORDER BY "createdAt" DESC
      LIMIT 50
    `);
    console.log(`\n📋 Retro Requests (${retroRequests.rows.length}):`);
    retroRequests.rows.forEach(r => {
      console.log(`   - ${r.requestNumber} - ${r.status}`);
    });
    
    console.log('\n✅ Data recovery complete!');
    console.log('\n📊 Summary:');
    console.log(`   - ${members.rows.length} members`);
    console.log(`   - ${vehicles.rows.length} vehicles`);
    console.log(`   - ${usages.rows.length} usages`);
    console.log(`   - ${transactions.rows.length} transactions`);
    console.log(`   - ${subscribers.rows.length} subscribers`);
    console.log(`   - ${retroRequests.rows.length} retro requests`);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

await recoverRealData();
