const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'sentinelbot',
  user: process.env.DB_USER || 'sentinelbot',
  password: process.env.DB_PASSWORD || 'sentinelbot123',
};

async function setupDatabase() {
  console.log('🗄️  Setting up SentinelBot Database...');
  
  try {
    // Connect to PostgreSQL
    const client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Creating database schema...');
    await client.query(schema);
    console.log('✅ Database schema created');

    // Read and execute seeds
    const seedsPath = path.join(__dirname, '../database/seeds.sql');
    const seeds = fs.readFileSync(seedsPath, 'utf8');
    
    console.log('🌱 Inserting seed data...');
    await client.query(seeds);
    console.log('✅ Seed data inserted');

    // Verify setup
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Users in database: ${result.rows[0].count}`);

    await client.end();
    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. Check connection settings in .env file');
      console.log('3. Verify database credentials');
    }
    
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
