# 🛡️ SentinelBot - Automated Cybersecurity Pentest Platform

SentinelBot is a comprehensive SaaS platform that automates cybersecurity penetration testing using industry-standard tools
like Nmap, Nikto, SQLMap, and OWASP ZAP. The platform provides AI-powered vulnerability analysis and 
generates detailed reports for security professionals.

![image](https://github.com/user-attachments/assets/968797f8-866c-4b49-8052-64770d14a658)


## 🚀 Features

- **Automated Pentesting**: Run scans using Nmap, Nikto, SQLMap, and other security tools
- **AI-Powered Analysis**: Intelligent vulnerability assessment and risk scoring
- **Real-time Dashboard**: Monitor scan progress and view results in real-time
- **Report Generation**: Export detailed PDF and CSV reports
- **REST API**: CI/CD integration support
- **Multi-user Support**: Secure user authentication and authorization
- **Background Processing**: Asynchronous scan execution with job queuing

## 🏗️ Architecture

```
SentinelBot/
├── frontend/          # React.js + Tailwind CSS
├── backend/           # Node.js + Express API
├── scripts/           # Pentest tools and AI analyzer
├── docker/            # Docker configuration
├── docs/              # Documentation and API specs
└── database/          # Database migrations and seeds
```

## 🛠️ Tech Stack

- **Frontend**: React.js, Tailwind CSS, Chart.js
- **Backend**: Node.js, Express.js, JWT Authentication
- **Database**: PostgreSQL
- **Queue**: BullMQ (Redis-based)
- **AI Engine**: Simulated vulnerability analyzer
- **Security Tools**: Nmap, Nikto, SQLMap, OWASP ZAP
- **Containerization**: Docker & Docker Compose

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd SentinelBot
```

2. **Install dependencies**
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

3. **Setup environment variables**
```bash
cp backend/.env.example backend/.env
# Edit the .env file with your configuration
```

4. **Start the development servers**
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm start
```

### Docker Setup

```bash
# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

## 📊 Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Scans Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `target` (String)
- `scan_type` (String)
- `status` (Enum: pending, running, complete, error)
- `started_at` (Timestamp)
- `completed_at` (Timestamp)

### Scan Results Table
- `id` (UUID, Primary Key)
- `scan_id` (UUID, Foreign Key)
- `vulnerability_type` (String)
- `risk_level` (Enum: low, medium, high, critical)
- `description` (Text)
- `fix_suggestion` (Text)
- `raw_output` (JSON)

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- Input validation and sanitization
- Rate limiting on API endpoints
- SQL injection prevention
- XSS protection
- CORS configuration
- Secure headers implementation

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Scans
- `GET /api/scans` - List user's scans
- `POST /api/scans` - Create new scan
- `GET /api/scans/:id` - Get scan details
- `DELETE /api/scans/:id` - Delete scan

### Reports
- `GET /api/scans/:id/report/pdf` - Download PDF report
- `GET /api/scans/:id/report/csv` - Download CSV report

## 🤖 AI Vulnerability Analyzer

The AI engine analyzes scanner outputs and provides:
- Risk level assessment (Low/Medium/High/Critical)
- Human-readable vulnerability summaries
- Actionable fix suggestions
- CVSS scoring when applicable

## 🔧 Development

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Code Style
```bash
# Lint backend
cd backend && npm run lint

# Lint frontend
cd frontend && npm run lint
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

SentinelBot is designed for authorized security testing only. Users are responsible for ensuring they have proper authorization before scanning any targets. Unauthorized scanning may violate laws and regulations.
#   S e n t i n e l B o t 
 
 #   S e n t i n e l B o t 
 
 
