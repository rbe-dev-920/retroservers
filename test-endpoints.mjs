#!/usr/bin/env node

/**
 * Test script pour valider les endpoints CRUD générés
 * Teste la persistence des données pour tous les modèles
 */

const BASE_URL = process.env.API_URL || 'https://attractive-kindness-rbe-serveurs.up.railway.app';
const TOKEN_RAW = 'stub.' + Buffer.from('test@retrobus.fr').toString('base64');
const AUTH_HEADER = `Bearer ${TOKEN_RAW}`;

// Modèles à tester
const MODELS = [
  'vehicle',
  'event',
  'flash',
  'retro-request',
  'retro-request-file',
  'site-users',
  'document',
  'vehicle-maintenance',
  'vehicle-service-schedule',
  'usage',
  'vehicle-control-technique',
  'vehicle-cession-certificate',
  'vehicle-grayscale',
  'vehicle-insurance',
  'vehicle-inspection'
];

async function testModel(model) {
  console.log(`\n🧪 Testing ${model}...`);
  
  try {
    // Test GET (Read)
    const getRes = await fetch(`${BASE_URL}/api/${model}`, {
      headers: { 'Authorization': AUTH_HEADER }
    });
    
    if (!getRes.ok) {
      console.log(`  ❌ GET /api/${model} failed: ${getRes.status}`);
      return false;
    }
    console.log(`  ✅ GET /api/${model} works`);
    
    // Test POST (Create)
    const testData = {
      name: `test-${model}-${Date.now()}`,
      status: 'active',
      description: `Test data for ${model}`
    };
    
    const postRes = await fetch(`${BASE_URL}/api/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    if (!postRes.ok) {
      console.log(`  ⚠️  POST /api/${model} failed: ${postRes.status}`);
      return false;
    }
    
    const created = await postRes.json();
    console.log(`  ✅ POST /api/${model} works - Created: ${created.id || 'unknown'}`);
    
    // If we got an ID, test PUT and DELETE
    if (created.id) {
      // Test PUT (Update)
      const putRes = await fetch(`${BASE_URL}/api/${model}/${created.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': AUTH_HEADER,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...testData, status: 'updated' })
      });
      
      if (putRes.ok) {
        console.log(`  ✅ PUT /api/${model}/:id works`);
      } else {
        console.log(`  ⚠️  PUT /api/${model}/:id failed: ${putRes.status}`);
      }
      
      // Test DELETE (Delete)
      const deleteRes = await fetch(`${BASE_URL}/api/${model}/${created.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': AUTH_HEADER }
      });
      
      if (deleteRes.ok) {
        console.log(`  ✅ DELETE /api/${model}/:id works`);
      } else {
        console.log(`  ⚠️  DELETE /api/${model}/:id failed: ${deleteRes.status}`);
      }
    }
    
    return true;
  } catch (e) {
    console.log(`  ❌ Error testing ${model}: ${e.message}`);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 ENDPOINT CRUD TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Testing at ${BASE_URL}`);
  console.log(`Testing ${MODELS.length} models...\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const model of MODELS) {
    const success = await testModel(model);
    if (success) passed++;
    else failed++;
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${passed}/${MODELS.length} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');
}

// Check if server is running
fetch(`${BASE_URL}/api/status`)
  .then(() => runTests())
  .catch(() => {
    console.error(`❌ Cannot connect to ${BASE_URL}`);
    console.error('Make sure the server is running: npm run start');
    process.exit(1);
  });
