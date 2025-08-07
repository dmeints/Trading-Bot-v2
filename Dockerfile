# Multi-stage Docker build for Skippy Trading Platform
# Optimized for production deployment with minimal image size

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Install all dependencies (including devDependencies)
RUN npm ci --frozen-lockfile

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY cli/ ./cli/
COPY public/ ./public/

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Stage 2: Production runtime
FROM node:20-alpine AS production

# Set Node environment
ENV NODE_ENV=production
ENV PORT=5000

# Create app user for security
RUN addgroup -g 1001 -S skippy && \
    adduser -S skippy -u 1001

# Set working directory
WORKDIR /app

# Install runtime system dependencies
RUN apk add --no-cache \
    tini \
    curl \
    postgresql-client

# Copy built application from builder stage
COPY --from=builder --chown=skippy:skippy /app/node_modules ./node_modules
COPY --from=builder --chown=skippy:skippy /app/dist ./dist
COPY --from=builder --chown=skippy:skippy /app/package.json ./
COPY --from=builder --chown=skippy:skippy /app/cli ./cli

# Create necessary directories
RUN mkdir -p /app/logs /app/models /app/tmp /app/simulation-reports && \
    chown -R skippy:skippy /app

# Copy health check script
COPY --chown=skippy:skippy docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER skippy

# Expose port
EXPOSE 5000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/server/index.js"]