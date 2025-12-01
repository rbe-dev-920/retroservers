// persistence.js - Abstraction layer for memory vs database storage
import pg from 'pg';

const { Pool } = pg;

let dbPool = null;
let useDatabase = false;

// Initialize database connection if DATABASE_URL points to PostgreSQL
export async function initDatabase() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('postgresql')) {
    console.log('[DB] Using in-memory storage (development mode)');
    return;
  }

  try {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Required for Railway
    });

    // Test connection
    await dbPool.query('SELECT NOW()');
    useDatabase = true;
    console.log('[DB] ✅ Connected to PostgreSQL');
  } catch (error) {
    console.error('[DB] ❌ Failed to connect to PostgreSQL:', error.message);
    console.log('[DB] Falling back to in-memory storage');
  }
}

// Helper to run migrations/init schema
export async function initSchema() {
  if (!useDatabase) return;
  
  try {
    // Create tables if they don't exist
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        parc VARCHAR(50) UNIQUE NOT NULL,
        marque VARCHAR(100),
        modele VARCHAR(100),
        etat VARCHAR(50) DEFAULT 'disponible',
        fuel INTEGER DEFAULT 0,
        caracteristiques JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] Schema initialized');
  } catch (error) {
    console.error('[DB] Schema init error:', error.message);
  }
}

// Vehicles storage
export const vehicleStore = {
  getAll: async () => {
    if (!useDatabase) return null; // Signal to use in-memory
    
    try {
      const result = await dbPool.query('SELECT * FROM vehicles');
      return result.rows;
    } catch (error) {
      console.error('[DB] Error fetching vehicles:', error.message);
      return null;
    }
  },

  getByParc: async (parc) => {
    if (!useDatabase) return null;
    
    try {
      const result = await dbPool.query('SELECT * FROM vehicles WHERE parc = $1', [parc]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DB] Error fetching vehicle:', error.message);
      return null;
    }
  },

  create: async (vehicle) => {
    if (!useDatabase) return null;
    
    try {
      const result = await dbPool.query(
        `INSERT INTO vehicles (parc, marque, modele, etat, fuel, caracteristiques)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [vehicle.parc, vehicle.marque, vehicle.modele, vehicle.etat, vehicle.fuel, JSON.stringify(vehicle.caracteristiques || [])]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[DB] Error creating vehicle:', error.message);
      return null;
    }
  },

  update: async (parc, vehicle) => {
    if (!useDatabase) return null;
    
    try {
      const result = await dbPool.query(
        `UPDATE vehicles SET marque = $1, modele = $2, etat = $3, fuel = $4, caracteristiques = $5, updated_at = NOW()
         WHERE parc = $6
         RETURNING *`,
        [vehicle.marque, vehicle.modele, vehicle.etat, vehicle.fuel, JSON.stringify(vehicle.caracteristiques || []), parc]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DB] Error updating vehicle:', error.message);
      return null;
    }
  }
};

// Members storage
export const memberStore = {
  getAll: async () => {
    if (!useDatabase) return null;
    
    try {
      const result = await dbPool.query('SELECT * FROM members');
      return result.rows;
    } catch (error) {
      console.error('[DB] Error fetching members:', error.message);
      return null;
    }
  },

  getByEmail: async (email) => {
    if (!useDatabase) return null;
    
    try {
      const result = await dbPool.query('SELECT * FROM members WHERE email = $1', [email]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DB] Error fetching member:', error.message);
      return null;
    }
  }
};

export { useDatabase };
