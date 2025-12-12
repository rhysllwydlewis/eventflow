# Docker Compose for EventFlow

## Quick Start

### Prerequisites
- Docker Desktop installed
- Docker Compose installed (included with Docker Desktop)

### Start all services

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
```

This will start:
- **MongoDB** on port 27017
- **EventFlow App** on port 3000
- **Mongo Express** (Web UI) on port 8081

### Access the services

- **EventFlow:** http://localhost:3000
- **API Documentation:** http://localhost:3000/api-docs
- **MongoDB Web UI:** http://localhost:8081 (admin/admin)

### Stop services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes database data)
docker-compose down -v
```

### Rebuild after code changes

```bash
# Rebuild and restart
docker-compose up -d --build
```

### Run migrations

```bash
# Access the app container
docker-compose exec app sh

# Inside container, run migrations
npm run migrate
```

### View MongoDB data

```bash
# Access MongoDB container
docker-compose exec mongodb mongosh -u admin -p eventflow_password

# Inside MongoDB shell
use eventflow
show collections
db.users.find().pretty()
```

## Development Workflow

### Hot reload

The application uses volume mounting, so code changes are reflected immediately (if using nodemon).

### Install new packages

```bash
# Inside the app container
docker-compose exec app npm install package-name

# Or rebuild
docker-compose up -d --build
```

### Database backups

```bash
# Backup
docker-compose exec mongodb mongodump --uri="mongodb://admin:eventflow_password@localhost:27017/eventflow?authSource=admin" --out=/dump

# Restore
docker-compose exec mongodb mongorestore --uri="mongodb://admin:eventflow_password@localhost:27017/eventflow?authSource=admin" /dump/eventflow
```

## Troubleshooting

### MongoDB won't start

```bash
# Check logs
docker-compose logs mongodb

# Reset MongoDB data
docker-compose down -v
docker-compose up -d
```

### App won't connect to MongoDB

```bash
# Verify MongoDB is running
docker-compose ps

# Check MongoDB health
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Port conflicts

If ports are already in use, edit `docker-compose.yml` to use different ports:

```yaml
ports:
  - "3001:3000"  # Change host port
```

## Production Deployment

For production, use environment-specific compose file:

```bash
# Create docker-compose.prod.yml with production settings
docker-compose -f docker-compose.prod.yml up -d
```

Or use container orchestration platforms like:
- Kubernetes
- Docker Swarm
- AWS ECS
- Google Cloud Run
