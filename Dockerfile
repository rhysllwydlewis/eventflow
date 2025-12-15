# Use official Node LTS image
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
# Skip lifecycle scripts (like husky prepare) during production install
RUN npm install --omit=dev --ignore-scripts

# Bundle app source
COPY . .

# Default port (Railway will override PORT at runtime)
ENV PORT=3000

# Expose the port for documentation purposes
EXPOSE 3000

# Add health check - Railway will use this to determine if the app is ready
# Check every 10 seconds, start after 10 seconds, timeout after 5 seconds
# If 3 consecutive checks fail, mark as unhealthy
# Note: Using shell form to support PORT variable substitution
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c 'curl -f http://localhost:${PORT:-3000}/api/health || exit 1'

# Start the server
CMD ["node", "server.js"]
