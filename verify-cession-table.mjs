import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

try {
  // Check if table exists and its structure
  const tables = await c.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'VehicleCessionCertificate'
  `);
  
  if (tables.rows.length > 0) {
    console.log('✅ VehicleCessionCertificate table exists in database');
    
    // Get column info
    const columns = await c.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'VehicleCessionCertificate'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if there's any data
    const data = await c.query('SELECT COUNT(*) as count FROM "VehicleCessionCertificate"');
    console.log(`\n📊 Records in table: ${data.rows[0].count}`);
    
  } else {
    console.log('❌ VehicleCessionCertificate table not found');
  }
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
