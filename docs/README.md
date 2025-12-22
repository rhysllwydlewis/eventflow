# EventFlow Documentation

## Quick Links

- **[MongoDB Verification Guide](./MONGODB_VERIFICATION.md)** - Verify your deployment is properly using MongoDB
- **[MongoDB Setup (Simple)](./.github/docs/MONGODB_SETUP_SIMPLE.md)** - Step-by-step MongoDB Atlas setup
- **[MongoDB Setup (Technical)](./.github/docs/MONGODB_SETUP.md)** - Detailed MongoDB configuration
- **[Deployment Guide](./.github/docs/DEPLOYMENT_GUIDE.md)** - Deploy to production

## Health Monitoring

Your deployment exposes two health endpoints:

### `/api/health` - Overall System Health

Always returns HTTP 200. Shows MongoDB status and which backend is active.

```bash
curl https://your-domain.com/api/health
```

### `/api/ready` - Readiness Probe

Returns HTTP 200 only when MongoDB is connected. Returns HTTP 503 if not ready.

```bash
curl https://your-domain.com/api/ready
```

## Critical: Data Persistence

EventFlow stores ALL data in MongoDB when properly configured:

- User accounts, authentication, profiles
- Supplier data, packages, photos
- Messages, events, plans
- Reviews, ratings, categories
- All other application data

**Check your deployment:** `/api/health` should show `"activeBackend": "mongodb"`

If it shows `"activeBackend": "local"`, your data is NOT PERSISTENT and will be lost on restart!

See [MongoDB Verification Guide](./MONGODB_VERIFICATION.md) for troubleshooting.
