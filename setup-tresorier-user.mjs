#!/usr/bin/env node

const API_BASE = 'http://localhost:3001';
const USERNAME = 'w.belaidi';
const EMAIL = 'w.belaidi@retrobus.org';
const FIRST_NAME = 'Walid';
const LAST_NAME = 'Belaidi';
const TARGET_ROLE = 'TRESORIER';
const DUMMY_TOKEN = 'stub.test';

async function main() {
  try {
    console.log(`🔍 Searching for user: ${USERNAME}...`);
    
    // Try to find existing user
    let userId = null;
    try {
      const searchRes = await fetch(`${API_BASE}/api/admin/members/search/${USERNAME}`, {
        headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
      });
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.found) {
          userId = searchData.user.id;
          console.log(`✅ Found existing user: ${searchData.user.email} (ID: ${userId})`);
        }
      }
    } catch (e) {
      console.log(`ℹ️  User not found, will try to create`);
    }
    
    // If not found, create it
    if (!userId) {
      console.log(`\n📝 Creating new user: ${USERNAME}...`);
      
      const createRes = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DUMMY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: USERNAME,
          email: EMAIL,
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          password: 'TempPassword123!',
          role: TARGET_ROLE
        })
      });
      
      if (!createRes.ok) {
        const error = await createRes.json();
        console.error(`❌ Create failed: ${createRes.status}`);
        console.error(error);
        // Continue to try to set role anyway
      } else {
        const userData = await createRes.json();
        userId = userData.id || userData.user?.id;
        console.log(`✅ User created: ${EMAIL} (ID: ${userId})`);
      }
    }
    
    // Set/verify role is TRESORIER
    if (userId) {
      console.log(`\n🔄 Setting role to: ${TARGET_ROLE}...`);
      
      const roleRes = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DUMMY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: TARGET_ROLE })
      });
      
      if (!roleRes.ok) {
        const error = await roleRes.json();
        console.error(`❌ Role change failed: ${roleRes.status}`);
        console.error(error);
        process.exit(1);
      }
      
      const roleData = await roleRes.json();
      console.log(`✅ Role set successfully!`);
      console.log(`   User: ${roleData.user.email}`);
      console.log(`   Role: ${roleData.user.role}`);
      console.log(`\n🎉 ${USERNAME} can now see "Gestion des notes de frais" tab!`);
      console.log(`   Email: ${EMAIL}`);
      console.log(`   Role: ${TARGET_ROLE}`);
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
