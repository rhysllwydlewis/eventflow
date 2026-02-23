# Messenger v4 Data Migration

Run the migration script to convert legacy v1/v2/v3 message threads and conversations
into the Messenger v4 data model (`conversations_v4` / `chat_messages_v4` collections).

## Prerequisites

- MongoDB connection available and configured
- `MONGODB_URI` environment variable set (or `MONGO_URI` / `DATABASE_URL`)
- Application dependencies installed (`npm install`)
- **Do not run while the production server is under heavy load**

## Environment Variables

| Variable      | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `MONGODB_URI` | MongoDB connection string (required)                        |
| `DRY_RUN`     | Set to `true` to preview changes without writing (optional) |
| `BATCH_SIZE`  | Number of threads to process per batch (default: 100)       |

## Running the Migration

```bash
# Dry-run first to preview what will be migrated
DRY_RUN=true npm run migrate:messenger-v4

# Run the actual migration
npm run migrate:messenger-v4
```

The script is idempotent — re-running it will skip already-migrated conversations.

## After Migration

1. Verify conversation counts in MongoDB: `conversations_v4` collection.
2. Test the Messenger v4 UI at `/messenger/`.
3. Keep the legacy collections intact until you have confirmed all data migrated successfully.
