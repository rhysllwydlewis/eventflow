# Use official Node LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Default port (Railway will override PORT at runtime)
ENV PORT=3000

# Expose the port for documentation purposes
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
