/**
 * Script to restore data from backup into Prisma database
 * Usage: node restore-from-backup.js <backup-folder-path>
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function restoreBackup(backupPath) {
  try {
    console.log(`📂 Loading backup from: ${backupPath}`);
    
    const dataPath = path.join(backupPath, 'data.json');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Backup file not found: ${dataPath}`);
    }
    
    const backupData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✅ Backup loaded, timestamp: ${backupData.timestamp}`);
    
    // Restore tables in order
    const tables = backupData.tables || {};
    
    // 1. Members
    if (tables.members?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.members.data.length} members...`);
      for (const member of tables.members.data) {
        await prisma.member.upsert({
          where: { id: member.id },
          update: member,
          create: member,
        });
      }
      console.log(`✅ Members restored`);
    }
    
    // 2. Site Users
    if (tables.site_users?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.site_users.data.length} site users...`);
      for (const user of tables.site_users.data) {
        await prisma.siteUser.upsert({
          where: { id: user.id },
          update: user,
          create: user,
        });
      }
      console.log(`✅ Site users restored`);
    }
    
    // 3. Vehicles
    if (tables.Vehicle?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.Vehicle.data.length} vehicles...`);
      for (const vehicle of tables.Vehicle.data) {
        await prisma.vehicle.upsert({
          where: { id: vehicle.id },
          update: vehicle,
          create: {
            parc: vehicle.parc,
            marque: vehicle.marque,
            modele: vehicle.modele,
            etat: vehicle.etat,
            fuel: vehicle.fuel,
            caracteristiques: JSON.stringify(vehicle.caracteristiques),
            createdAt: new Date(vehicle.createdAt),
          },
        });
      }
      console.log(`✅ Vehicles restored`);
    }
    
    // 4. Events
    if (tables.Event?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.Event.data.length} events...`);
      for (const event of tables.Event.data) {
        await prisma.event.upsert({
          where: { id: event.id },
          update: event,
          create: {
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date ? new Date(event.date) : null,
            status: event.status,
            extras: event.extras ? JSON.stringify(event.extras) : null,
            createdAt: new Date(event.createdAt),
          },
        });
      }
      console.log(`✅ Events restored`);
    }
    
    // 5. RetroNews
    if (tables.RetroNews?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.RetroNews.data.length} news...`);
      for (const news of tables.RetroNews.data) {
        await prisma.retroNews.upsert({
          where: { id: news.id },
          update: news,
          create: {
            id: news.id,
            title: news.title,
            body: news.content || news.body,
            content: news.content,
            excerpt: news.excerpt,
            imageUrl: news.imageUrl,
            author: news.author,
            status: news.published ? 'published' : 'draft',
            published: news.published,
            featured: news.featured,
            publishedAt: news.publishedAt ? new Date(news.publishedAt) : null,
            createdAt: new Date(news.createdAt),
          },
        });
      }
      console.log(`✅ News restored`);
    }
    
    // 6. Flashes
    if (tables.Flash?.data?.length > 0) {
      console.log(`\n📥 Restoring ${tables.Flash.data.length} flashes...`);
      for (const flash of tables.Flash.data) {
        await prisma.flash.upsert({
          where: { id: flash.id },
          update: flash,
          create: {
            id: flash.id,
            title: flash.title,
            message: flash.message,
            content: flash.content,
            type: flash.type,
            active: flash.active,
            createdAt: new Date(flash.createdAt),
          },
        });
      }
      console.log(`✅ Flashes restored`);
    }
    
    console.log(`\n✨ Backup restoration completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Members: ${tables.members?.data?.length || 0}`);
    console.log(`   - Site Users: ${tables.site_users?.data?.length || 0}`);
    console.log(`   - Vehicles: ${tables.Vehicle?.data?.length || 0}`);
    console.log(`   - Events: ${tables.Event?.data?.length || 0}`);
    console.log(`   - News: ${tables.RetroNews?.data?.length || 0}`);
    console.log(`   - Flashes: ${tables.Flash?.data?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Error during restoration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup path from command line or use latest
const backupPath = process.argv[2] || path.join(__dirname, 'backups/backup_2025-12-02T00-21-42');

restoreBackup(backupPath);
