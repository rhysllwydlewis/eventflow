# Sample Data for EventFlow Testing

This directory contains sample data files for testing EventFlow functionality.

## Files

- `users.json` - Sample user accounts (customer, supplier, admin)
- `suppliers.json` - Sample supplier profiles  
- `packages.json` - Sample service packages

## Usage

### Loading Sample Data

```bash
# Copy to data directory
cp data/sample/*.json data/

# Then run migration for MongoDB
npm run migrate
```

## Test Accounts

All passwords need to be set using password reset or manually hashed.

- `alice@example.com` - Customer account
- `bob@bobscatering.com` - Supplier account (Pro status)
- `admin@eventflow.com` - Admin account

