# Legacy API Shutdown Policy

This document describes the deprecation and shutdown policy for the v1, v2, and v3 messaging APIs in EventFlow. The current production system is **Messenger v4** at `/api/v4/messenger`.

---

## Deprecated Endpoints

| API Version  | Route Prefix                         | Sunset Date |
| ------------ | ------------------------------------ | ----------- |
| v1 Messages  | `/api/v1/messages` · `/api/messages` | 2026-12-31  |
| v2 Messaging | `/api/v2/messages`                   | 2026-12-31  |
| v3 Messenger | `/api/v3/messenger`                  | 2027-03-31  |

All deprecated endpoints respond with the following headers on every request:

```
X-API-Deprecation: true
X-API-Deprecation-Version: v1|v2|v3
X-API-Deprecation-Replacement: /api/v4/messenger
X-API-Deprecation-Info: ...
X-API-Deprecation-Sunset: <YYYY-MM-DD>
```

---

## Behaviour Controlled by `LEGACY_MESSAGING_MODE`

Set the `LEGACY_MESSAGING_MODE` environment variable to control how legacy endpoints behave:

| Value       | Behaviour                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `on`        | All requests (reads and writes) are forwarded to the legacy handler. Deprecation headers are always added.                    |
| `read-only` | **Default.** Read requests (`GET`) are forwarded. Write requests (`POST`, `PUT`, `PATCH`, `DELETE`) return **HTTP 410 Gone**. |
| `off`       | Same as `read-only`. Write requests return **HTTP 410 Gone**.                                                                 |

### 410 Gone Response Body

```json
{
  "error": "Gone",
  "message": "This v1 messaging endpoint has been shut down. Please migrate to /api/v4/messenger.",
  "replacement": "/api/v4/messenger",
  "docs": "/docs/LEGACY_API_SHUTDOWN.md"
}
```

---

## Staged Rollout

Recommended rollout sequence:

1. **Phase 1 – Observation** (`LEGACY_MESSAGING_MODE=on`):  
   Monitor deprecation warnings in logs (`[DEPRECATED API]`) to identify active clients.

2. **Phase 2 – Write Block** (`LEGACY_MESSAGING_MODE=read-only`):  
   Block all write operations. Clients still able to read data for a migration window.

3. **Phase 3 – Full Shutdown** (`LEGACY_MESSAGING_MODE=off`):  
   Identical to `read-only` today. In a future release, GET endpoints will also return 410 once no traffic is observed.

Set the variable in your environment file or deployment config:

```bash
# .env / Railway / Heroku config vars
LEGACY_MESSAGING_MODE=read-only   # default – safe during migration window
```

---

## Migrating Clients

### v1 → v4 Quick Reference

| v1 Endpoint                         | v4 Equivalent                                       |
| ----------------------------------- | --------------------------------------------------- |
| `GET /api/v1/messages/threads`      | `GET /api/v4/messenger/conversations`               |
| `GET /api/v1/messages/threads/:id`  | `GET /api/v4/messenger/conversations/:id`           |
| `POST /api/v1/messages/threads`     | `POST /api/v4/messenger/conversations`              |
| `POST /api/v1/messages/threads/:id` | `POST /api/v4/messenger/conversations/:id/messages` |
| `GET /api/v1/messages/unread`       | `GET /api/v4/messenger/unread-count`                |

### v2 → v4 Quick Reference

| v2 Endpoint                      | v4 Equivalent                                       |
| -------------------------------- | --------------------------------------------------- |
| `POST /api/v2/messages/threads`  | `POST /api/v4/messenger/conversations`              |
| `GET /api/v2/messages/threads`   | `GET /api/v4/messenger/conversations`               |
| `GET /api/v2/messages/:threadId` | `GET /api/v4/messenger/conversations/:id/messages`  |
| `POST /api/v2/messages/send`     | `POST /api/v4/messenger/conversations/:id/messages` |

### v3 → v4 Quick Reference

| v3 Endpoint                                         | v4 Equivalent                                       |
| --------------------------------------------------- | --------------------------------------------------- |
| `POST /api/v3/messenger/conversations`              | `POST /api/v4/messenger/conversations`              |
| `GET /api/v3/messenger/conversations`               | `GET /api/v4/messenger/conversations`               |
| `POST /api/v3/messenger/conversations/:id/messages` | `POST /api/v4/messenger/conversations/:id/messages` |
| `GET /api/v3/messenger/search`                      | `GET /api/v4/messenger/search`                      |
| `GET /api/v3/messenger/contacts`                    | `GET /api/v4/messenger/contacts`                    |

### v4 Conversation Creation

v4 uses a 2-step pattern:

```javascript
// Step 1 – Create conversation
const { conversation } = await fetch('/api/v4/messenger/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({
    type: 'direct', // direct | marketplace | enquiry | supplier_network | support
    participantIds: ['user2Id'],
  }),
}).then(r => r.json());

// Step 2 – Send first message
await fetch(`/api/v4/messenger/conversations/${conversation._id}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ content: 'Hello!' }),
});
```

---

## Legacy UI Redirects

The following legacy page routes now redirect to the v4 Messenger:

| Old URL                      | Redirect Target                 |
| ---------------------------- | ------------------------------- |
| `/messages`                  | `/messenger/`                   |
| `/messages.html`             | `/messenger/`                   |
| `/conversation?id=<id>`      | `/messenger/?conversation=<id>` |
| `/conversation.html?id=<id>` | `/messenger/?conversation=<id>` |
| `/conversation/<id>`         | `/messenger/?conversation=<id>` |

---

## Checking Deprecation Warnings

All legacy API calls emit a structured warning to the application log:

```
[DEPRECATED API] v1 API called (LEGACY_MESSAGING_MODE=read-only): GET /api/v1/messages/threads – migrate to /api/v4/messenger
```

Use these log entries to audit active legacy API consumers before fully shutting down.
