# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for security tools
RUN apk add --no-cache \
    curl \
    nmap \
    nmap-scripts \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads temp

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sentinelbot -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R sentinelbot:nodejs /app

# Switch to non-root user
USER sentinelbot

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
