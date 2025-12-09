#!/usr/bin/env node

/**
 * Analyzer to understand schema requirements for each model
 * Generates fixes for POST endpoints
 */

import fs from 'fs';

const schema = fs.readFileSync('./prisma/schema.prisma', 'utf-8');

function extractModelSchema(modelName) {
  const modelRegex = new RegExp(`model\\s+${modelName}\\s*{([^}]+)}`, 's');
  const match = schema.match(modelRegex);
  
  if (!match) return null;
  
  const content = match[1];
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  
  const fields = {};
  
  lines.forEach(line => {
    const fieldMatch = line.match(/^\s*(\w+)\s+(\w+|\w+\[\])/);
    if (!fieldMatch) return;
    
    const fieldName = fieldMatch[1];
    const fieldType = fieldMatch[2];
    
    const isRequired = !line.includes('?') && !line.includes('@default');
    const hasDefault = /@default/.test(line);
    const isAutoIncrement = /@default\(autoincrement\(\)\)/.test(line);
    const isId = /@id/.test(line);
    const isRelation = line.includes('@relation');
    
    fields[fieldName] = {
      type: fieldType,
      isRequired,
      hasDefault,
      isAutoIncrement,
      isId,
      isRelation
    };
  });
  
  return fields;
}

// Check critical models
const modelsToCheck = [
  'Vehicle',
  'Event',
  'Flash',
  'Usage',
  'Stock',
  'StockMovement',
  'Document',
  'VehicleControlTechnique',
  'VehicleCessionCertificate'
];

console.log('═══════════════════════════════════════════════════════');
console.log('📊 SCHEMA ANALYSIS');
console.log('═══════════════════════════════════════════════════════\n');

modelsToCheck.forEach(modelName => {
  const fields = extractModelSchema(modelName);
  
  if (!fields) {
    console.log(`❌ ${modelName}: NOT FOUND`);
    return;
  }
  
  console.log(`📋 ${modelName}:`);
  
  const requiredFields = Object.entries(fields)
    .filter(([name, info]) => info.isRequired && !info.hasDefault && !info.isAutoIncrement && !info.isRelation)
    .map(([name]) => name);
    
  const autoIncrementFields = Object.entries(fields)
    .filter(([name, info]) => info.isAutoIncrement)
    .map(([name]) => name);
    
  const defaultFields = Object.entries(fields)
    .filter(([name, info]) => info.hasDefault && !info.isAutoIncrement)
    .map(([name]) => name);
  
  if (autoIncrementFields.length > 0) {
    console.log(`   🔑 Auto-increment: ${autoIncrementFields.join(', ')}`);
  }
  
  if (requiredFields.length > 0) {
    console.log(`   ✋ Required: ${requiredFields.join(', ')}`);
  }
  
  if (defaultFields.length > 0) {
    console.log(`   ⚙️  Auto-defaults: ${defaultFields.join(', ')}`);
  }
  
  console.log('');
});

console.log('═══════════════════════════════════════════════════════\n');
