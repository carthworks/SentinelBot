# SentinelBot Deployment Guide

## Quick Start with Docker

The fastest way to get SentinelBot running is using Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd SentinelBot

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Documentation: http://localhost:5000/api

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://sentinelbot:sentinelbot123@postgres:5432/sentinelbot
POSTGRES_DB=sentinelbot
POSTGRES_USER=sentinelbot
POSTGRES_PASSWORD=sentinelbot123

# Redis
REDIS_URL=redis://redis:6379

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Frontend
REACT_APP_API_URL=http://localhost:5000/api
```

### Optional Environment Variables

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Engine
OPENAI_API_KEY=your-openai-api-key-here

# Security Tools Paths
NMAP_PATH=/usr/bin/nmap
NIKTO_PATH=/usr/bin/nikto
SQLMAP_PATH=/usr/bin/sqlmap
```

## Production Deployment

### 1. Security Hardening

#### Update Default Credentials
```bash
# Generate secure passwords
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
openssl rand -base64 16  # For database password
```

#### Enable HTTPS
```bash
# Generate SSL certificates
mkdir -p docker/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/ssl/key.pem \
  -out docker/ssl/cert.pem
```

Update `docker-compose.yml` to enable HTTPS:
```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./docker/ssl:/etc/nginx/ssl
```

#### Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 2. Database Backup

#### Automated Backups
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec sentinelbot-postgres pg_dump -U sentinelbot sentinelbot > $BACKUP_DIR/sentinelbot_$DATE.sql
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

#### Restore from Backup
```bash
# Stop services
docker-compose down

# Restore database
docker-compose up -d postgres
docker exec -i sentinelbot-postgres psql -U sentinelbot -d sentinelbot < backup.sql

# Start all services
docker-compose up -d
```

### 3. Monitoring and Logging

#### Log Management
```bash
# Configure log rotation
cat > /etc/logrotate.d/sentinelbot << 'EOF'
/var/lib/docker/containers/*/*.log {
  daily
  missingok
  rotate 7
  compress
  notifempty
  create 0644 root root
}
EOF
```

#### Health Monitoring
```bash
# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
if ! curl -f http://localhost:5000/health > /dev/null 2>&1; then
  echo "Backend health check failed"
  docker-compose restart backend
fi
EOF

# Run every 5 minutes
echo "*/5 * * * * /path/to/health-check.sh" | crontab -
```

### 4. Performance Optimization

#### Database Optimization
```sql
-- Add to PostgreSQL configuration
shared_preload_libraries = 'pg_stat_statements'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

#### Redis Configuration
```bash
# Add to redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Cloud Deployment

### AWS Deployment

#### Using ECS with Fargate
```bash
# Build and push images
docker build -t sentinelbot-backend ./backend
docker build -t sentinelbot-frontend ./frontend

# Tag for ECR
docker tag sentinelbot-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/sentinelbot-backend:latest
docker tag sentinelbot-frontend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/sentinelbot-frontend:latest

# Push to ECR
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/sentinelbot-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/sentinelbot-frontend:latest
```

#### RDS Configuration
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier sentinelbot-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username sentinelbot \
  --master-user-password <secure-password> \
  --allocated-storage 20
```

### Google Cloud Platform

#### Using Cloud Run
```bash
# Build and deploy backend
gcloud builds submit --tag gcr.io/PROJECT-ID/sentinelbot-backend ./backend
gcloud run deploy sentinelbot-backend --image gcr.io/PROJECT-ID/sentinelbot-backend --platform managed

# Build and deploy frontend
gcloud builds submit --tag gcr.io/PROJECT-ID/sentinelbot-frontend ./frontend
gcloud run deploy sentinelbot-frontend --image gcr.io/PROJECT-ID/sentinelbot-frontend --platform managed
```

### Azure Deployment

#### Using Container Instances
```bash
# Create resource group
az group create --name sentinelbot-rg --location eastus

# Deploy containers
az container create \
  --resource-group sentinelbot-rg \
  --name sentinelbot \
  --image sentinelbot:latest \
  --dns-name-label sentinelbot \
  --ports 80 443
```

## Kubernetes Deployment

### Basic Kubernetes Manifests

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sentinelbot

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sentinelbot-config
  namespace: sentinelbot
data:
  DATABASE_URL: "postgresql://sentinelbot:password@postgres:5432/sentinelbot"
  REDIS_URL: "redis://redis:6379"

---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentinelbot-backend
  namespace: sentinelbot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sentinelbot-backend
  template:
    metadata:
      labels:
        app: sentinelbot-backend
    spec:
      containers:
      - name: backend
        image: sentinelbot-backend:latest
        ports:
        - containerPort: 5000
        envFrom:
        - configMapRef:
            name: sentinelbot-config
```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
docker exec sentinelbot-backend npm run db:test

# View database logs
docker logs sentinelbot-postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

#### Memory Issues
```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

#### SSL Certificate Issues
```bash
# Verify certificate
openssl x509 -in docker/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:443
```

### Performance Monitoring

#### Application Metrics
```bash
# Install monitoring stack
docker run -d --name prometheus prom/prometheus
docker run -d --name grafana grafana/grafana

# Configure Prometheus to scrape SentinelBot metrics
# Add to prometheus.yml:
scrape_configs:
  - job_name: 'sentinelbot'
    static_configs:
      - targets: ['backend:5000']
```

#### Log Analysis
```bash
# Centralized logging with ELK stack
docker run -d --name elasticsearch elasticsearch:7.14.0
docker run -d --name kibana kibana:7.14.0
docker run -d --name logstash logstash:7.14.0
```

## Maintenance

### Regular Maintenance Tasks

1. **Update Dependencies**
   ```bash
   # Update Docker images
   docker-compose pull
   docker-compose up -d
   ```

2. **Database Maintenance**
   ```bash
   # Vacuum and analyze
   docker exec sentinelbot-postgres psql -U sentinelbot -c "VACUUM ANALYZE;"
   ```

3. **Log Cleanup**
   ```bash
   # Clean Docker logs
   docker system prune -f
   ```

4. **Security Updates**
   ```bash
   # Update base images
   docker pull node:18-alpine
   docker pull postgres:15-alpine
   docker pull redis:7-alpine
   ```
