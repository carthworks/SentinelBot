const { spawn } = require('child_process');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🛡️  SentinelBot Complete Setup Guide');
console.log('=====================================\n');

// Check if Docker is available
async function checkDocker() {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['--version']);
    docker.on('close', (code) => {
      resolve(code === 0);
    });
    docker.on('error', () => {
      resolve(false);
    });
  });
}

// Check if PostgreSQL is running locally
async function checkLocalPostgres() {
  const config = {
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  };

  try {
    const client = new Client(config);
    await client.connect();
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

// Setup database with Docker
async function setupWithDocker() {
  console.log('🐳 Setting up with Docker...\n');
  
  return new Promise((resolve, reject) => {
    console.log('Starting PostgreSQL and Redis containers...');
    const dockerCompose = spawn('docker-compose', ['up', '-d', 'postgres', 'redis'], {
      cwd: path.join(__dirname, '..')
    });

    dockerCompose.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    dockerCompose.stderr.on('data', (data) => {
      console.log(data.toString());
    });

    dockerCompose.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Docker containers started successfully');
        // Wait a bit for containers to be ready
        setTimeout(() => resolve(true), 5000);
      } else {
        console.log('❌ Failed to start Docker containers');
        resolve(false);
      }
    });

    dockerCompose.on('error', (error) => {
      console.log('❌ Docker not available:', error.message);
      resolve(false);
    });
  });
}

// Create database schema
async function createSchema() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sentinelbot',
    user: process.env.DB_USER || 'sentinelbot',
    password: process.env.DB_PASSWORD || 'sentinelbot123',
  };

  console.log('📋 Creating database schema...');
  console.log('Connecting to:', `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  try {
    const client = new Client(dbConfig);
    await client.connect();

    // Read schema file if it exists
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    let schema;

    if (fs.existsSync(schemaPath)) {
      schema = fs.readFileSync(schemaPath, 'utf8');
    } else {
      // Use embedded schema
      schema = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        CREATE TYPE scan_status AS ENUM ('pending', 'running', 'complete', 'error', 'cancelled');
        CREATE TYPE risk_level AS ENUM ('info', 'low', 'medium', 'high', 'critical');
        CREATE TYPE scan_type AS ENUM ('nmap', 'nikto', 'sqlmap', 'zap', 'comprehensive');

        CREATE TABLE users (
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

        CREATE TABLE scans (
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
            progress INTEGER DEFAULT 0
        );

        CREATE TABLE scan_results (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
            vulnerability_type VARCHAR(255) NOT NULL,
            risk_level risk_level NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            fix_suggestion TEXT,
            cvss_score DECIMAL(3,1),
            cve_id VARCHAR(50),
            affected_component VARCHAR(255),
            port INTEGER,
            service VARCHAR(100),
            raw_output JSONB,
            ai_analysis JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Insert admin user (password: admin123)
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) 
        VALUES ('admin@sentinelbot.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uDjO', 'Admin', 'User', 'admin', true)
        ON CONFLICT (email) DO NOTHING;
      `;
    }

    await client.query(schema);
    await client.end();

    console.log('✅ Database schema created successfully');
    return true;
  } catch (error) {
    console.error('❌ Schema creation failed:', error.message);
    return false;
  }
}

// Test database connection
async function testConnection() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sentinelbot',
    user: process.env.DB_USER || 'sentinelbot',
    password: process.env.DB_PASSWORD || 'sentinelbot123',
  };

  try {
    const client = new Client(dbConfig);
    await client.connect();
    
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Users in database: ${result.rows[0].count}`);
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

// Main setup function
async function main() {
  console.log('Checking system requirements...\n');

  const hasDocker = await checkDocker();
  const hasLocalPostgres = await checkLocalPostgres();

  console.log(`Docker available: ${hasDocker ? '✅' : '❌'}`);
  console.log(`Local PostgreSQL: ${hasLocalPostgres ? '✅' : '❌'}\n`);

  let setupSuccess = false;

  if (hasDocker) {
    console.log('🐳 Using Docker setup (recommended)...\n');
    setupSuccess = await setupWithDocker();
    
    if (setupSuccess) {
      // Wait for database to be ready
      console.log('⏳ Waiting for database to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } else if (hasLocalPostgres) {
    console.log('💻 Using local PostgreSQL...\n');
    setupSuccess = true;
  } else {
    console.log('❌ No database system found!\n');
    console.log('Please install one of the following:');
    console.log('1. Docker Desktop (recommended): https://www.docker.com/products/docker-desktop');
    console.log('2. PostgreSQL: https://www.postgresql.org/download/');
    process.exit(1);
  }

  if (setupSuccess) {
    console.log('📋 Setting up database schema...\n');
    const schemaSuccess = await createSchema();
    
    if (schemaSuccess) {
      console.log('🧪 Testing database connection...\n');
      const testSuccess = await testConnection();
      
      if (testSuccess) {
        console.log('\n🎉 Database setup completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Install security tools: npm run install-tools');
        console.log('2. Start the backend server: npm run dev');
        console.log('3. Access the API at: http://localhost:5000');
        console.log('\nDefault login credentials:');
        console.log('Email: admin@sentinelbot.com');
        console.log('Password: admin123');
      }
    }
  }
}

// Run setup
main().catch(console.error);
