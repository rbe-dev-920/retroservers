#!/usr/bin/env node

/**
 * Detailed test script to debug endpoint errors
 */

const BASE_URL = process.env.API_URL || 'https://attractive-kindness-rbe-serveurs.up.railway.app';
const TOKEN_RAW = 'stub.' + Buffer.from('test@retrobus.fr').toString('base64');
const AUTH_HEADER = `Bearer ${TOKEN_RAW}`;

async function testDetailedCreate() {
  console.log('🧪 Testing detailed POST requests with error logging...\n');

  // Test 1: Vehicle
  console.log('📝 Testing POST /api/vehicle...');
  try {
    const testData = {
      parc: `TEST-${Math.random().toString(36).substring(7).toUpperCase()}`,
      marque: 'Test Brand',
      modele: 'Test Model',
      type: 'car',
      etat: 'OK'
    };

    const response = await fetch(`${BASE_URL}/api/vehicle`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 2: Event
  console.log('📝 Testing POST /api/event...');
  try {
    const testData = {
      title: `Test Event ${Date.now()}`,
      date: new Date().toISOString()
    };

    const response = await fetch(`${BASE_URL}/api/event`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 3: Flash
  console.log('📝 Testing POST /api/flash...');
  try {
    const testData = {
      title: `Test Flash ${Date.now()}`,
      content: 'Test content'
    };

    const response = await fetch(`${BASE_URL}/api/flash`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 4: Usage
  console.log('📝 Testing POST /api/usage...');
  try {
    const testData = {
      parc: 'TEST-USAGE',
      conducteur: 'Test Conductor'
    };

    const response = await fetch(`${BASE_URL}/api/usage`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }
}

testDetailedCreate();
