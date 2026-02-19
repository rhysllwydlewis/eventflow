# Messenger v4 – Production Status

_Last updated: February 2026_

## Status: ✅ Production-Ready

Messenger v4 is the canonical messaging system for EventFlow. All previous versions (v1, v2, v3) are deprecated with sunset dates.

---

## Canonical Routes

| Resource | Path |
|---|---|
| Messenger UI | `/messenger/` |
| API base | `/api/v4/messenger` |
| Admin moderation | `/admin-messenger.html` |

---

## API Endpoints (v4)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v4/messenger/conversations` | List conversations for authenticated user |
| POST | `/api/v4/messenger/conversations` | Create conversation |
| GET | `/api/v4/messenger/conversations/:id` | Get single conversation |
| PATCH | `/api/v4/messenger/conversations/:id` | Update settings |
| DELETE | `/api/v4/messenger/conversations/:id` | Delete conversation |
| GET | `/api/v4/messenger/conversations/:id/messages` | Get messages (cursor-paginated) |
| POST | `/api/v4/messenger/conversations/:id/messages` | Send message |
| PATCH | `/api/v4/messenger/conversations/:id/messages/:msgId` | Edit message |
| DELETE | `/api/v4/messenger/conversations/:id/messages/:msgId` | Delete message |
| POST | `/api/v4/messenger/conversations/:id/messages/:msgId/react` | Toggle reaction |
| POST | `/api/v4/messenger/conversations/:id/read` | Mark conversation as read |
| GET | `/api/v4/messenger/unread` | Get unread count |
| GET | `/api/v4/messenger/search` | Search messages |
| POST | `/api/v4/messenger/typing` | Send typing indicator |
| GET | `/api/v4/messenger/contacts` | Search contacts |
| GET | `/api/v4/messenger/admin/conversations` | Admin: list all conversations (admin role required) |
| GET | `/api/v4/messenger/admin/metrics` | Admin: operational metrics (admin role required) |

---

## WebSocket Event Conventions

WebSocket events use Socket.IO. The server emits v4-namespaced events; the client-side `MessengerSocket.js` bridges them to window CustomEvents.

### Socket.IO server → client events

| Socket event | Window CustomEvent dispatched | Payload |
|---|---|---|
| `messenger:v4:message` | `messenger:v4:message` + `messenger:new-message` | `{ conversationId, message }` |
| `messenger:v4:typing` | `messenger:typing` | `{ conversationId, userId, isTyping, userName }` |
| `messenger:v4:conversation-created` | `messenger:new-conversation` | `{ conversation }` |
| `messenger:v4:conversation-updated` | `messenger:conversation-updated` | `{ conversationId, ... }` |
| `messenger:v4:message-edited` | `messenger:message-edited` | `{ conversationId, messageId, ... }` |
| `messenger:v4:message-deleted` | `messenger:message-deleted` | `{ conversationId, messageId }` |
| `messenger:v4:reaction` | `messenger:reaction-updated` | `{ conversationId, messageId, ... }` |
| `messenger:v4:read` | `messenger:conversation-read` | `{ conversationId }` |
| `messenger:v4:presence` | `messenger:presence` | `{ userId, status }` |

### Event naming rules

- **`messenger:v4:*`** — canonical low-level event names (preferred for new code listening directly to socket or window events).
- **`messenger:new-message`** — bridge alias for `messenger:v4:message`; retained for backward compatibility.
- `ChatViewV4` listens to **both** `messenger:v4:message` and `messenger:new-message` with deduplication via message ID.

---

## Dashboard Integration

Both customer and supplier dashboards initialize `MessengerWidgetV4`:

| Dashboard | File | Widget container |
|---|---|---|
| Customer | `public/dashboard-customer.html` | `#messenger-dashboard-widget` |
| Supplier | `public/dashboard-supplier.html` | `#messenger-dashboard-widget-supplier` |

Both dashboards include:
- `/messenger/css/messenger-widget-v4.css`
- `/messenger/js/MessengerWidgetV4.js` (deferred)
- `/messenger/js/MessengerTrigger.js` (deferred)
- `/messenger/js/NotificationBridge.js` (deferred)

The widget is initialized on `DOMContentLoaded` with `new MessengerWidgetV4('<containerId>', { maxItems: 5 })`.

---

## Legacy Deprecation Status

| Version | Deprecation status | Sunset |
|---|---|---|
| v1 threads (`/api/v1/threads`) | Deprecated | 2026-06-01 |
| v2 messaging (`/api/v2/messaging`) | Deprecated | 2026-06-01 |
| v3 messenger (`/api/v3/messenger`) | Deprecated | 2026-09-01 |
| `/messages.html` | Deprecated (redirects to `/messenger/`) | 2026-06-01 |
| `MessengerWidget.js` (v3) | Deprecated | 2026-09-01 |

Deprecated routes set `X-API-Deprecation: true` and related headers on all responses.

---

## Admin Moderation

The admin moderation view is available at `/admin-messenger.html` (requires admin login). It:
- Calls `GET /api/v4/messenger/admin/conversations` with pagination and search
- Displays conversation table with deep-link to `/messenger/?conversation=<id>`
- Requires `req.user.role === 'admin'` server-side

---

## Entry Points (Non-Messenger Pages)

Messenger v4 conversations can be initiated from:
- Supplier profile pages
- Package listing pages
- Marketplace listings
- Customer dashboard
- Supplier dashboard

All use the v4 two-step pattern: `POST /api/v4/messenger/conversations` then redirect or open widget.

---

## Environment Flags

| Flag | Description |
|---|---|
| `WEBSOCKET_MODE=v2` | Enables WebSocket server v2 (required for v4 real-time events) |
| `MESSENGER_RATE_LIMIT_*` | Per-tier rate limiting configuration |

---

## Manual QA Verification Steps

1. Navigate to `/messenger/` — UI loads, no console errors.
2. Select a conversation — messages load and chat header appears.
3. Send a message — it appears immediately in the chat.
4. Open a second browser tab as the recipient — confirm real-time delivery via `messenger:v4:message` socket event → `messenger:new-message` window event → `ChatViewV4._onNewMessage`.
5. Open `/admin-messenger.html` as an admin user — conversation table loads with search and pagination.
6. Open `/dashboard-customer.html` or `/dashboard-supplier.html` — widget shows unread count badge without errors.
