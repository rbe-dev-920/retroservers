#!/usr/bin/env node

const API_BASE = 'http://localhost:3001';
const IDENTIFIER = 'w.belaidi';
const TARGET_ROLE = 'TRESORIER';
const DUMMY_TOKEN = 'stub.test'; // Auth stub for testing

async function main() {
  try {
    console.log(`🔍 Searching for user: ${IDENTIFIER}...`);
    
    // Step 1: Find the user
    const searchRes = await fetch(`${API_BASE}/api/admin/members/search/${IDENTIFIER}`, {
      headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
    });
    
    if (!searchRes.ok) {
      console.error(`❌ Search failed: ${searchRes.status}`);
      const error = await searchRes.json();
      console.error(error);
      process.exit(1);
    }
    
    const searchData = await searchRes.json();
    
    if (!searchData.found) {
      console.error(`❌ User not found: ${IDENTIFIER}`);
      process.exit(1);
    }
    
    const user = searchData.user;
    console.log(`✅ Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current role: ${user.role}`);
    
    if (user.role === TARGET_ROLE) {
      console.log(`✅ User already has role: ${TARGET_ROLE}`);
      process.exit(0);
    }
    
    console.log(`\n🔄 Changing role to: ${TARGET_ROLE}...`);
    
    // Step 2: Change role
    const roleRes = await fetch(`${API_BASE}/api/admin/users/${user.id}/role`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DUMMY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: TARGET_ROLE })
    });
    
    if (!roleRes.ok) {
      console.error(`❌ Role change failed: ${roleRes.status}`);
      const error = await roleRes.json();
      console.error(error);
      process.exit(1);
    }
    
    const roleData = await roleRes.json();
    console.log(`✅ Role updated successfully!`);
    console.log(`   User: ${roleData.user.email}`);
    console.log(`   New role: ${roleData.user.role}`);
    console.log(`\n🎉 ${IDENTIFIER} can now see "Gestion des notes de frais" tab`);
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
