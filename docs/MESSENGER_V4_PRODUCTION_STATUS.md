# Messenger v4 Production Status

> Last updated: February 2026

## Overview

Messenger v4 is the **canonical** messaging system for EventFlow. All legacy APIs
(v1, v2, v3) are deprecated with active sunset dates and will be removed in a
future release.

---

## Canonical Routes

| Concern | Route |
|---|---|
| Messenger UI (canonical) | `/messenger/` |
| Admin dashboard entry point | `/admin.html` |
| Admin message moderation | `/admin.html` → "Message Moderation" section |

---

## Canonical API

| Resource | Method | Path |
|---|---|---|
| List conversations (user) | GET | `/api/v4/messenger/conversations` |
| Get conversation | GET | `/api/v4/messenger/conversations/:id` |
| Update conversation | PATCH | `/api/v4/messenger/conversations/:id` |
| Delete conversation | DELETE | `/api/v4/messenger/conversations/:id` |
| List messages | GET | `/api/v4/messenger/conversations/:id/messages` |
| Send message | POST | `/api/v4/messenger/conversations/:id/messages` |
| Edit message | PATCH | `/api/v4/messenger/messages/:id` |
| Delete message | DELETE | `/api/v4/messenger/messages/:id` |
| Toggle reaction | POST | `/api/v4/messenger/messages/:id/reactions` |
| Mark as read | POST | `/api/v4/messenger/conversations/:id/read` |
| Typing indicator | POST | `/api/v4/messenger/conversations/:id/typing` |
| Unread count | GET | `/api/v4/messenger/unread-count` |
| Contacts | GET | `/api/v4/messenger/contacts` |
| Search | GET | `/api/v4/messenger/search` |
| **Admin: list all conversations** | GET | `/api/v4/messenger/admin/conversations` |
| **Admin: metrics** | GET | `/api/v4/messenger/admin/metrics` |

### Admin Conversations Endpoint

`GET /api/v4/messenger/admin/conversations`

- Requires: authenticated session **and** `role === 'admin'`
- Returns minimal safe data (no message body content by default)
- Query parameters:
  - `limit` (default 20, max 100)
  - `skip` (offset pagination)
  - `search` (searches participant names, business names, context title)
  - `status` (filters by conversation status)
- Response shape:

```json
{
  "success": true,
  "conversations": [ ... ],
  "total": 42
}
```

---

## Admin Moderation UI

The **Message Moderation** section is embedded directly in `/admin.html`. It provides:

- A search input (by participant name/email, or conversation ID)
- Status filter (all / active / archived / blocked)
- Paginated table with columns: Participants, Context, Last Message, Unread Count
- **Open** action deep-linking to `/messenger/?conversation=<id>`

No separate admin page is required; the moderation panel is part of the main
admin dashboard.

---

## Legacy Deprecation

| API version | Status | Sunset |
|---|---|---|
| v1 (`/api/v1/threads`) | Deprecated | End of Q2 2026 |
| v2 (`/api/v2/messaging`) | Deprecated | End of Q2 2026 |
| v3 (`/api/v3/messenger`) | Deprecated | End of Q3 2026 |
| v4 (`/api/v4/messenger`) | **Canonical** | — |

### Legacy page `/messages.html`

The `/messages.html` page is a **legacy** UI. It may still be served for backward
compatibility but is no longer the canonical messaging entry point. E2E tests and
all new code must target `/messenger/` instead.

---

## WebSocket / CustomEvent Naming Conventions

### Socket events (server → client)

| Socket event | Description |
|---|---|
| `messenger:v4:message` | New message received |
| `messenger:v4:typing` | Typing indicator update |
| `messenger:v4:conversation-created` | New conversation created |
| `messenger:v4:conversation-updated` | Conversation metadata changed |
| `messenger:v4:message-edited` | Message edited |
| `messenger:v4:message-deleted` | Message deleted |
| `messenger:v4:reaction` | Emoji reaction added/removed |
| `messenger:v4:read` | Conversation marked as read |
| `messenger:v4:presence` | User presence changed |

### Browser CustomEvents (window)

`MessengerSocket.js` bridges all socket events into browser `CustomEvent`s:

| CustomEvent | Triggered by |
|---|---|
| `messenger:new-message` | `messenger:v4:message` socket event |
| `messenger:typing` | `messenger:v4:typing` socket event |
| `messenger:new-conversation` | `messenger:v4:conversation-created` socket event |
| `messenger:conversation-updated` | `messenger:v4:conversation-updated` socket event |
| `messenger:message-edited` | `messenger:v4:message-edited` socket event |
| `messenger:message-deleted` | `messenger:v4:message-deleted` socket event |
| `messenger:reaction-updated` | `messenger:v4:reaction` socket event |
| `messenger:conversation-read` | `messenger:v4:read` socket event |
| `messenger:presence` | `messenger:v4:presence` socket event |
| `messenger:connected` | Socket connected |
| `messenger:disconnected` | Socket disconnected |
| `messenger:connection-failed` | Repeated reconnect failures |

`ChatViewV4.js` subscribes to **both** `messenger:new-message` and
`messenger:v4:message` to ensure updates arrive whether or not the socket bridge
is active.

---

## Environment Flags

| Flag | Default | Purpose |
|---|---|---|
| `WEBSOCKET_MODE` | `v2` | Enables v2 WebSocket server (`websocket-server-v2.js`) |
| `MESSENGER_V4_ENABLED` | `true` | Feature flag for v4 API routes |
| `LEGACY_MESSENGER_ENABLED` | `true` | Keeps v1-v3 routes active (shows deprecation headers) |

---

## Dashboard Integration

Both customer and supplier dashboards include the v4 messenger widget:

- `public/dashboard-customer.html` — `MessengerWidgetV4` initialized on
  `DOMContentLoaded` targeting `#messenger-dashboard-widget`
- `public/dashboard-supplier.html` — `MessengerWidgetV4` initialized on
  `DOMContentLoaded` targeting `#messenger-dashboard-widget-supplier`

Scripts loaded on both dashboards:
- `/messenger/js/MessengerWidgetV4.js`
- `/messenger/js/MessengerTrigger.js`
- `/messenger/js/NotificationBridge.js`

No legacy messaging dashboard scripts are referenced.
