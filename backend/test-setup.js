const { spawn } = require('child_process');
const { Client } = require('pg');
require('dotenv').config();

console.log('🧪 SentinelBot Backend Setup Test');
console.log('==================================\n');

// Test database connection
async function testDatabase() {
  console.log('📊 Testing Database Connection...');
  
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
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, COUNT(*) as user_count FROM users');
    console.log('✅ Database connection successful');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   Users in database: ${result.rows[0].user_count}`);
    
    await client.end();
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running and credentials are correct');
    return false;
  }
}

// Test security tools
async function testTool(name, command, args = ['--version']) {
  return new Promise((resolve) => {
    const process = spawn(command, args, { shell: true });
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      const success = code === 0 && output.length > 0;
      console.log(`${success ? '✅' : '❌'} ${name}: ${success ? 'Available' : 'Not found'}`);
      if (success && output) {
        const version = output.split('\n')[0].substring(0, 80);
        console.log(`   ${version}`);
      }
      resolve(success);
    });
    
    process.on('error', (error) => {
      console.log(`❌ ${name}: Not found (${error.message})`);
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      process.kill();
      console.log(`❌ ${name}: Timeout`);
      resolve(false);
    }, 5000);
  });
}

async function testSecurityTools() {
  console.log('\n🛡️  Testing Security Tools...');
  
  const tools = [
    { name: 'Node.js', command: 'node', args: ['--version'] },
    { name: 'Python', command: 'python', args: ['--version'] },
    { name: 'Nmap', command: 'nmap', args: ['--version'] },
    { name: 'SQLMap', command: 'sqlmap', args: ['--version'] },
    { name: 'Nikto', command: 'nikto', args: ['-Version'] }
  ];
  
  let availableTools = 0;
  
  for (const tool of tools) {
    const isAvailable = await testTool(tool.name, tool.command, tool.args);
    if (isAvailable) availableTools++;
  }
  
  console.log(`\n📊 Tools Summary: ${availableTools}/${tools.length} available`);
  
  if (availableTools < 3) {
    console.log('\n💡 To install missing tools:');
    console.log('   Windows: npm run install-tools');
    console.log('   Linux/Mac: npm run install-tools-linux');
    console.log('   Manual: See SECURITY_TOOLS_SETUP.md');
  }
  
  return availableTools;
}

// Test environment configuration
function testEnvironment() {
  console.log('\n⚙️  Testing Environment Configuration...');
  
  const requiredVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];
  
  let configuredVars = 0;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    const isSet = value && value.length > 0;
    console.log(`${isSet ? '✅' : '❌'} ${varName}: ${isSet ? 'Set' : 'Missing'}`);
    if (isSet) configuredVars++;
  }
  
  console.log(`\n📊 Environment: ${configuredVars}/${requiredVars.length} variables configured`);
  
  if (configuredVars < requiredVars.length) {
    console.log('\n💡 Create .env file with required variables');
    console.log('   Copy from .env.example and update values');
  }
  
  return configuredVars;
}

// Test backend server
async function testServer() {
  console.log('\n🚀 Testing Backend Server...');
  
  return new Promise((resolve) => {
    const server = spawn('node', ['src/server.js'], { 
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let serverStarted = false;
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running on port') || output.includes('listening on port')) {
        console.log('✅ Backend server starts successfully');
        serverStarted = true;
        server.kill();
        resolve(true);
      }
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') || output.includes('error')) {
        console.log('❌ Backend server failed to start');
        console.log(`   Error: ${output.trim()}`);
        server.kill();
        resolve(false);
      }
    });
    
    server.on('close', (code) => {
      if (!serverStarted) {
        console.log(`❌ Backend server exited with code ${code}`);
        resolve(false);
      }
    });
    
    server.on('error', (error) => {
      console.log('❌ Failed to start server:', error.message);
      resolve(false);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverStarted) {
        console.log('❌ Server start timeout');
        server.kill();
        resolve(false);
      }
    }, 10000);
  });
}

// Main test function
async function runTests() {
  console.log('Running comprehensive backend setup tests...\n');
  
  const results = {
    environment: testEnvironment(),
    database: await testDatabase(),
    tools: await testSecurityTools(),
    server: await testServer()
  };
  
  console.log('\n🎯 Test Results Summary');
  console.log('========================');
  console.log(`Environment: ${results.environment >= 7 ? '✅ Good' : '❌ Needs attention'}`);
  console.log(`Database: ${results.database ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Security Tools: ${results.tools >= 3 ? '✅ Ready' : '❌ Install needed'}`);
  console.log(`Backend Server: ${results.server ? '✅ Working' : '❌ Issues found'}`);
  
  const overallScore = Object.values(results).filter(Boolean).length;
  console.log(`\n📊 Overall Score: ${overallScore}/4`);
  
  if (overallScore === 4) {
    console.log('\n🎉 Perfect! Your SentinelBot backend is ready to go!');
    console.log('\nNext steps:');
    console.log('1. Start the backend: npm run dev');
    console.log('2. Access API at: http://localhost:5000');
    console.log('3. Test with frontend at: http://localhost:3000');
  } else {
    console.log('\n🔧 Setup needs attention. Please fix the issues above.');
    console.log('\nQuick fixes:');
    if (!results.database) console.log('- Start PostgreSQL or Docker containers');
    if (results.tools < 3) console.log('- Install security tools: npm run install-tools');
    if (results.environment < 7) console.log('- Configure .env file properly');
    if (!results.server) console.log('- Check server logs for errors');
  }
}

// Run tests
runTests().catch(console.error);
