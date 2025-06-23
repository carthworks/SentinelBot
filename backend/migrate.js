const { Client } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'sentinelbot',
  user: process.env.DB_USER || 'sentinelbot',
  password: process.env.DB_PASSWORD || 'sentinelbot123',
};

// If DATABASE_URL is provided, use it
if (process.env.DATABASE_URL) {
  dbConfig.connectionString = process.env.DATABASE_URL;
}

async function createDatabase() {
  console.log('🗄️  Setting up SentinelBot Database...');
  console.log('Database config:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user
  });
  
  try {
    // First, try to connect to the specific database
    let client = new Client(dbConfig);
    
    try {
      await client.connect();
      console.log('✅ Connected to existing database');
    } catch (error) {
      if (error.code === '3D000') {
        // Database doesn't exist, create it
        console.log('📋 Database does not exist, creating...');
        await client.end();
        
        // Connect to postgres database to create our database
        const adminConfig = { ...dbConfig, database: 'postgres' };
        client = new Client(adminConfig);
        await client.connect();
        
        await client.query(`CREATE DATABASE ${dbConfig.database}`);
        console.log(`✅ Database '${dbConfig.database}' created`);
        await client.end();
        
        // Reconnect to our new database
        client = new Client(dbConfig);
        await client.connect();
      } else {
        throw error;
      }
    }

    console.log('📋 Creating database schema...');
    await createSchema(client);

    // Verify setup
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Tables created: ${result.rows.map(r => r.table_name).join(', ')}`);

    // Check if admin user exists
    const userCheck = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', ['admin@sentinelbot.com']);
    console.log(`👥 Admin user exists: ${userCheck.rows[0].count > 0 ? 'Yes' : 'No'}`);

    await client.end();
    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. For Docker: run "docker-compose up -d postgres"');
      console.log('3. For local: start PostgreSQL service');
      console.log('4. Check connection settings in .env file');
    }
    
    process.exit(1);
  }
}

async function createSchema(client) {
  const schema = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Create enum types
    DO $$ BEGIN
        CREATE TYPE scan_status AS ENUM ('pending', 'running', 'complete', 'error', 'cancelled');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
        CREATE TYPE risk_level AS ENUM ('info', 'low', 'medium', 'high', 'critical');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
        CREATE TYPE scan_type AS ENUM ('nmap', 'nikto', 'sqlmap', 'zap', 'comprehensive');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
    );

    -- Refresh tokens table
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- API keys table
    CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '{}',
        last_used TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Scans table
    CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target VARCHAR(255) NOT NULL,
        scan_type scan_type NOT NULL DEFAULT 'comprehensive',
        status scan_status DEFAULT 'pending',
        title VARCHAR(255),
        description TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        scan_options JSONB DEFAULT '{}',
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100)
    );

    -- Scan results table
    CREATE TABLE IF NOT EXISTS scan_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        vulnerability_type VARCHAR(255) NOT NULL,
        risk_level risk_level NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        fix_suggestion TEXT,
        cvss_score DECIMAL(3,1) CHECK (cvss_score >= 0 AND cvss_score <= 10),
        cve_id VARCHAR(50),
        affected_component VARCHAR(255),
        port INTEGER,
        service VARCHAR(100),
        raw_output JSONB,
        ai_analysis JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Scan reports table
    CREATE TABLE IF NOT EXISTS scan_reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        report_type VARCHAR(50) NOT NULL,
        file_size INTEGER,
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
    CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
    CREATE INDEX IF NOT EXISTS idx_scan_results_risk_level ON scan_results(risk_level);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

    -- Insert default admin user (password: admin123)
    INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) 
    VALUES (
        'admin@sentinelbot.com', 
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uDjO', 
        'Admin', 
        'User', 
        'admin', 
        true
    )
    ON CONFLICT (email) DO NOTHING;
  `;

  await client.query(schema);
  console.log('✅ Database schema created successfully');
}

// Run migration
if (require.main === module) {
  createDatabase();
}

module.exports = { createDatabase };
