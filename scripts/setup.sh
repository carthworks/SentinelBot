#!/bin/bash

# SentinelBot Setup Script
# This script sets up the SentinelBot development environment

set -e

echo "🛡️  SentinelBot Setup Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if Node.js is installed (for development)
check_nodejs() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed. This is required for development."
        echo "Visit: https://nodejs.org/"
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
    fi
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
        
        # Generate secure secrets
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        DB_PASSWORD=$(openssl rand -base64 16)
        
        # Update .env file with generated secrets
        sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
        sed -i "s/your-super-secret-refresh-key-change-this-in-production/$JWT_REFRESH_SECRET/g" .env
        sed -i "s/sentinelbot123/$DB_PASSWORD/g" .env
        
        print_success "Generated secure secrets for JWT and database"
    else
        print_warning ".env file already exists, skipping creation"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Backend dependencies
    if [ -f "backend/package.json" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi
    
    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Start only PostgreSQL and Redis
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Check if database is accessible
    if docker-compose exec postgres pg_isready -U sentinelbot; then
        print_success "Database is ready"
    else
        print_error "Database is not ready. Please check the logs."
        docker-compose logs postgres
        exit 1
    fi
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    docker-compose build
    print_success "Docker images built successfully"
}

# Start all services
start_services() {
    print_status "Starting all services..."
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 15
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    print_status "Checking service health..."
    
    # Check backend health
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        print_success "Backend service is healthy"
    else
        print_warning "Backend service is not responding"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend service is healthy"
    else
        print_warning "Frontend service is not responding"
    fi
    
    # Check database
    if docker-compose exec postgres pg_isready -U sentinelbot > /dev/null 2>&1; then
        print_success "Database service is healthy"
    else
        print_warning "Database service is not responding"
    fi
    
    # Check Redis
    if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis service is healthy"
    else
        print_warning "Redis service is not responding"
    fi
}

# Show service URLs
show_urls() {
    echo ""
    echo "🎉 SentinelBot is now running!"
    echo "================================"
    echo ""
    echo "📱 Frontend:     http://localhost:3000"
    echo "🔧 Backend API:  http://localhost:5000"
    echo "📚 API Docs:     http://localhost:5000/api"
    echo "🏥 Health Check: http://localhost:5000/health"
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "   Email:    admin@sentinelbot.com"
    echo "   Password: admin123"
    echo ""
    echo "📋 Useful Commands:"
    echo "   View logs:        docker-compose logs -f"
    echo "   Stop services:    docker-compose down"
    echo "   Restart:          docker-compose restart"
    echo "   View status:      docker-compose ps"
    echo ""
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    docker-compose down
}

# Main setup function
main() {
    echo "Starting SentinelBot setup..."
    echo ""
    
    # Check prerequisites
    check_docker
    check_nodejs
    
    # Setup environment
    setup_environment
    
    # Ask user for setup type
    echo ""
    echo "Choose setup type:"
    echo "1) Development setup (install dependencies locally)"
    echo "2) Docker-only setup (recommended for quick start)"
    read -p "Enter your choice (1 or 2): " setup_type
    
    case $setup_type in
        1)
            print_status "Setting up development environment..."
            install_dependencies
            setup_database
            ;;
        2)
            print_status "Setting up Docker-only environment..."
            build_images
            start_services
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
    
    # Show final information
    show_urls
    
    print_success "Setup completed successfully!"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"
