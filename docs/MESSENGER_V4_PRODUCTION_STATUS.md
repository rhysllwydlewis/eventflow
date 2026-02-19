# Messenger v4 Production Status

> Last updated: February 2026

## Overview

Messenger v4 is the **canonical** messaging system for EventFlow. All legacy APIs
(v1, v2, v3) are deprecated with active sunset dates and will be removed in a
future release.

---

## UI/UX Polish (Gold Standard)

> Added February 2026 – `public/messenger/css/messenger-v4-polish.css`

### What was changed

| Area | Change |
|---|---|
| **Glass hierarchy** | Three-level glassmorphism: page background (teal-tinted gradient), panels (sidebar/chat with `backdrop-filter: blur(20px)`), cards (conversation items, bubbles with lighter blur) |
| **Conversation list** | Stronger selected state (teal left border + tinted bg), hover/press transforms, unread items use bolder typography |
| **Unread badge** | Teal badge with drop shadow; pulses (`is-pulsing` animation) when count increases (triggered in `ConversationListV4._onConversationsChanged`) |
| **Date headers** | Sticky pill treatment with horizontal rule lines on each side; frosted glass backdrop |
| **Message entrance** | `messenger-v4__message--fade-in` → `mvMsgEnter` keyframe (fade + scale-up), transform-origin differs for sent vs received |
| **Conversation cross-fade** | `is-switching` class on `.messenger-v4__messages` triggers `mvChatFadeIn` on each conversation switch (ChatViewV4.js) |
| **Scroll-to-bottom** | Frosted glass circle, teal icon; slides up on appear; hover fills teal |
| **Sent bubble** | Vivid teal gradient + inset highlight; tighter border-radius asymmetry |
| **Received bubble** | Glass background with subtle teal border |
| **Reactions** | `.messenger-v4__reaction-pill` glass pill; `is-entering` triggers `mvReactionPop` spring animation |
| **Read receipts** | `messenger-v4__read-receipt` transitions colour from grey → teal (`--read` modifier) |
| **Context menu** | Frosted glass panel with `mvContextMenuIn` entrance animation |
| **Composer** | Premium focus ring (teal glow), disabled/placeholder states, send-button loading spinner via `--loading` modifier, char-count warning colour, error banner |
| **Emoji picker popover** | `.messenger-v4__emoji-popover` glass panel with `mvPopoverIn` entrance |
| **Attachment previews** | `.messenger-v4__attachment-card` glass card with remove button |
| **Mobile transitions** | `handleMobilePanel()` in MessengerAppV4.js now adds `is-entering`/`is-leaving` classes for CSS slide animations (`mvSlideInRight`, `mvSlideOutLeft`, etc.) with 260 ms duration; falls back to instant toggle for `prefers-reduced-motion` |
| **Accessibility** | `focus-visible` outlines on all interactive elements; touch targets ≥44 px on mobile (WCAG 2.5.5); `prefers-reduced-motion` guard disables all new animations |
| **High-contrast** | `@media (prefers-contrast: high)` adds explicit borders on bubbles and date headers |

### Files changed

| File | Type | Notes |
|---|---|---|
| `public/messenger/css/messenger-v4-polish.css` | **New** | All UI/UX polish styles (≈420 lines) |
| `public/messenger/index.html` | Updated | Added `<link>` for `messenger-v4-polish.css` |
| `public/messenger/js/MessengerAppV4.js` | Updated | `handleMobilePanel` uses animated CSS transitions |
| `public/messenger/js/ChatViewV4.js` | Updated | `loadConversation` adds `is-switching` for cross-fade |
| `public/messenger/js/ConversationListV4.js` | Updated | `_onConversationsChanged` pulses newly-increased unread badges |

### How to test

1. **Glass hierarchy** – Open `/messenger/` and check that the page background, sidebar, chat panel, and individual bubbles each have progressively lighter glass layers.
2. **Conversation switch** – Click between conversations; the message area should briefly fade in.
3. **Unread badge pulse** – Use a second browser tab / another account to send a message; observe the unread badge in the conversation list pulse twice then settle.
4. **Date headers** – Scroll through a conversation spanning multiple days; the date pill should remain sticky near the top while scrolling.
5. **Message entrance** – Send or receive a message and observe the bubble scale-up animation.
6. **Scroll-to-bottom** – Scroll up in a long conversation; a teal circle button should appear bottom-right and scroll on click.
7. **Mobile transitions** – Resize browser to ≤767 px (or DevTools mobile mode), select a conversation — sidebar should slide out left while chat slides in from right. Back button reverses this.
8. **Reduced motion** – Enable "Reduce motion" in OS/browser settings; all animations should be replaced with instant changes.
9. **Keyboard nav** – Tab through the conversation list; each item should show a clear teal focus ring.
10. **High contrast** – Enable forced-colours/high-contrast mode; bubbles and date headers gain explicit borders.

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
