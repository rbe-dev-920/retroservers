#!/usr/bin/env node
/**
 * Test Prisma connection and basic queries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('✅ Testing Prisma connection...\n');

    // Test 1: Count members
    const memberCount = await prisma.members.count();
    console.log(`📊 Members: ${memberCount}`);

    // Test 2: Count vehicles
    const vehicleCount = await prisma.vehicle.count();
    console.log(`🚌 Vehicles: ${vehicleCount}`);

    // Test 3: Count events
    const eventCount = await prisma.event.count();
    console.log(`📅 Events: ${eventCount}`);

    // Test 4: List vehicles
    if (vehicleCount > 0) {
      const vehicles = await prisma.vehicle.findMany({ take: 3 });
      console.log(`\n🚌 First vehicles:`);
      vehicles.forEach(v => {
        console.log(`  - ${v.parc}: ${v.marque} ${v.modele}`);
      });
    }

    // Test 5: List members
    if (memberCount > 0) {
      const members = await prisma.members.findMany({ take: 3 });
      console.log(`\n👥 First members:`);
      members.forEach(m => {
        console.log(`  - ${m.firstName} ${m.lastName} (${m.email})`);
      });
    }

    console.log('\n✅ All Prisma tests passed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
