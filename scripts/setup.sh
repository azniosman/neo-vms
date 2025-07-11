#!/bin/bash

# Neo VMS Setup Script
# This script sets up the Neo VMS visitor management system

set -e

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_status "Starting Neo VMS setup..."

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f env.example ]; then
        cp env.example .env
        print_success "Created .env file from template"
        print_warning "Please edit .env file with your configuration before continuing"
        print_status "You can run this script again after configuring .env"
        exit 0
    else
        print_error "env.example file not found. Please create .env file manually"
        exit 1
    fi
fi

# Check required environment variables
print_status "Validating environment configuration..."

required_vars=(
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "SESSION_SECRET"
    "DB_PASSWORD"
    "REDIS_PASSWORD"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing or empty required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Please update your .env file with proper values"
    exit 1
fi

print_success "Environment configuration validated"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p uploads logs ssl backups
print_success "Directories created"

# Install dependencies
print_status "Installing backend dependencies..."
npm install

print_status "Installing frontend dependencies..."
cd client && npm install && cd ..
print_success "Dependencies installed"

# Generate SSL certificates for development
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    print_status "Generating SSL certificates for development..."
    mkdir -p ssl
    openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=SG/ST=Singapore/L=Singapore/O=Neo VMS/OU=IT/CN=localhost"
    print_success "SSL certificates generated"
fi

# Initialize database
print_status "Initializing database..."
if command -v docker &> /dev/null; then
    print_status "Using Docker for database initialization..."
    docker-compose up -d database
    sleep 10
    docker-compose exec -T database psql -U neo_vms_user -d neo_vms -f /docker-entrypoint-initdb.d/init-db.sql
else
    print_warning "Docker not found. Please ensure your database is running and accessible"
fi

# Create admin user
print_status "Creating admin user..."
node scripts/create-admin.js
print_success "Admin user setup completed"

# Run tests
print_status "Running tests..."
npm test
print_success "Tests completed"

# Build frontend
print_status "Building frontend..."
cd client && npm run build && cd ..
print_success "Frontend built"

print_success "Neo VMS setup completed successfully!"
print_status "You can now start the system with:"
echo "  npm run dev          # Development mode"
echo "  docker-compose up    # Production mode with Docker"
echo ""
print_status "Access the application at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:3001"
echo "  Health Check: http://localhost:3001/api/health" 