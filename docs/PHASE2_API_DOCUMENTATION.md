# Phase 2 API Documentation

## Table of Contents

- [Folder API](#folder-api)
- [Label API](#label-api)
- [Advanced Search API](#advanced-search-api)
- [Authentication](#authentication)
- [Error Handling](#error-handling)

---

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Folder API

Base URL: `/api/v2/folders`

### Create Folder

**POST** `/api/v2/folders`

Create a new custom folder.

**Request Body:**

```json
{
  "name": "Work Projects",
  "parentId": null,
  "color": "#3B82F6",
  "icon": "💼",
  "settings": {
    "autoArchiveAfterDays": null,
    "notificationEnabled": true,
    "sortBy": "date"
  }
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "folder": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "user123",
    "name": "Work Projects",
    "parentId": null,
    "color": "#3B82F6",
    "icon": "💼",
    "messageCount": 0,
    "unreadCount": 0,
    "order": 7,
    "isSystemFolder": false,
    "metadata": {
      "createdAt": "2025-02-17T12:00:00.000Z",
      "updatedAt": "2025-02-17T12:00:00.000Z"
    }
  }
}
```

### List Folders

**GET** `/api/v2/folders`

Get all folders for the current user.

**Query Parameters:**

- `tree` (optional): Set to `true` to get hierarchical folder structure

**Response:** `200 OK`

```json
{
  "success": true,
  "folders": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Inbox",
      "icon": "📥",
      "messageCount": 15,
      "unreadCount": 3
    }
  ],
  "count": 6
}
```

### Get Folder

**GET** `/api/v2/folders/:id`

Get details of a specific folder.

**Response:** `200 OK`

```json
{
  "success": true,
  "folder": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Work Projects",
    "messageCount": 42,
    "unreadCount": 5,
    "metadata": {
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastMessageAt": "2025-02-17T11:30:00.000Z"
    }
  }
}
```

### Update Folder

**PUT** `/api/v2/folders/:id`

Update folder properties.

**Request Body:**

```json
{
  "name": "Updated Name",
  "color": "#10B981",
  "settings": {
    "notificationEnabled": false
  }
}
```

**Response:** `200 OK`

### Delete Folder

**DELETE** `/api/v2/folders/:id`

Soft delete a folder (moves messages to Inbox).

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Folder deleted successfully"
}
```

### Restore Folder

**POST** `/api/v2/folders/:id/restore`

Restore a deleted folder.

**Response:** `200 OK`

### Move Folder

**POST** `/api/v2/folders/:id/move`

Move folder to new parent.

**Request Body:**

```json
{
  "newParentId": "507f1f77bcf86cd799439012"
}
```

**Response:** `200 OK`

### Move Messages to Folder

**POST** `/api/v2/folders/:id/messages`

Move multiple messages to a folder.

**Request Body:**

```json
{
  "messageIds": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "2 message(s) moved successfully",
  "modifiedCount": 2
}
```

### Empty Folder

**POST** `/api/v2/folders/:id/empty`

Delete all messages in a folder.

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "15 message(s) deleted",
  "deletedCount": 15
}
```

### Get Folder Statistics

**GET** `/api/v2/folders/:id/stats`

Get folder statistics.

**Response:** `200 OK`

```json
{
  "success": true,
  "stats": {
    "folderId": "507f1f77bcf86cd799439011",
    "name": "Work Projects",
    "messageCount": 42,
    "unreadCount": 5,
    "totalSize": 10485760,
    "lastMessageAt": "2025-02-17T11:30:00.000Z"
  }
}
```

### Initialize System Folders

**POST** `/api/v2/folders/initialize`

Initialize default system folders for user (Inbox, Sent, Drafts, Starred, Archived, Trash).

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "System folders initialized",
  "folders": [],
  "count": 6
}
```

### Create Folder Rule

**POST** `/api/v2/folders/:id/rules`

Create an auto-filing rule for a folder.

**Request Body:**

```json
{
  "name": "Auto-file work emails",
  "condition": {
    "from": "@company.com"
  },
  "action": "move",
  "isActive": true
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "rule": {
    "_id": "507f1f77bcf86cd799439022",
    "name": "Auto-file work emails",
    "isActive": true
  }
}
```

### Update Folder Rule

**PUT** `/api/v2/folders/:id/rules/:ruleId`

Update a folder rule.

**Request Body:**

```json
{
  "name": "Updated rule name",
  "isActive": false
}
```

**Response:** `200 OK`

### Delete Folder Rule

**DELETE** `/api/v2/folders/:id/rules/:ruleId`

Delete a folder rule.

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Rule deleted successfully"
}
```

### Test Folder Rule

**POST** `/api/v2/folders/:id/rules/:ruleId/test`

Test a rule to see how many messages it would match.

**Response:** `200 OK`

```json
{
  "success": true,
  "result": {
    "ruleId": "507f1f77bcf86cd799439022",
    "ruleName": "Auto-file work emails",
    "matchCount": 15,
    "condition": { "from": "@company.com" }
  }
}
```

### Reorder Folders

**POST** `/api/v2/folders/reorder`

Reorder multiple folders at once.

**Request Body:**

```json
{
  "folderOrders": [
    { "folderId": "507f1f77bcf86cd799439011", "order": 1 },
    { "folderId": "507f1f77bcf86cd799439012", "order": 2 }
  ]
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Folders reordered",
  "count": 2
}
```

---

## Label API

Base URL: `/api/v2/labels`

### Create Label

**POST** `/api/v2/labels`

Create a new label.

**Request Body:**

```json
{
  "name": "Urgent",
  "color": "#FFFFFF",
  "backgroundColor": "#EF4444",
  "icon": "🚨"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "label": {
    "_id": "507f1f77bcf86cd799439015",
    "userId": "user123",
    "name": "Urgent",
    "color": "#FFFFFF",
    "backgroundColor": "#EF4444",
    "icon": "🚨",
    "messageCount": 0,
    "metadata": {
      "createdAt": "2025-02-17T12:00:00.000Z"
    }
  }
}
```

### List Labels

**GET** `/api/v2/labels`

Get all labels for the current user.

**Response:** `200 OK`

```json
{
  "success": true,
  "labels": [
    {
      "_id": "507f1f77bcf86cd799439015",
      "name": "Urgent",
      "color": "#FFFFFF",
      "backgroundColor": "#EF4444",
      "icon": "🚨",
      "messageCount": 3
    }
  ],
  "count": 6
}
```

### Get Label

**GET** `/api/v2/labels/:id`

Get label details.

**Response:** `200 OK`

### Update Label

**PUT** `/api/v2/labels/:id`

Update label properties.

**Request Body:**

```json
{
  "name": "Super Urgent",
  "backgroundColor": "#DC2626"
}
```

**Response:** `200 OK`

### Delete Label

**DELETE** `/api/v2/labels/:id`

Delete a label (removes from all messages).

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Label deleted successfully",
  "deletedCount": 1
}
```

### Add Label to Message

**POST** `/api/v2/labels/:id/messages/:messageId`

Apply label to a message.

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Label added successfully",
  "modified": true
}
```

### Remove Label from Message

**DELETE** `/api/v2/labels/:id/messages/:messageId`

Remove label from a message.

**Response:** `200 OK`

### Bulk Apply Label

**POST** `/api/v2/labels/:id/apply-to-messages`

Apply label to multiple messages.

**Request Body:**

```json
{
  "messageIds": ["507f1f77bcf86cd799439016", "507f1f77bcf86cd799439017"]
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Label applied to 2 message(s)",
  "modifiedCount": 2
}
```

### Bulk Remove Label

**POST** `/api/v2/labels/:id/remove-from-messages`

Remove label from multiple messages.

**Request Body:**

```json
{
  "messageIds": ["507f1f77bcf86cd799439016"]
}
```

**Response:** `200 OK`

### Merge Labels

**POST** `/api/v2/labels/:id/merge`

Merge source label into target label.

**Request Body:**

```json
{
  "targetId": "507f1f77bcf86cd799439018"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Merged \"Old Label\" into \"New Label\"",
  "mergedCount": 15
}
```

### Get Label Statistics

**GET** `/api/v2/labels/:id/stats`

Get label usage statistics.

**Response:** `200 OK`

```json
{
  "success": true,
  "stats": {
    "labelId": "507f1f77bcf86cd799439015",
    "name": "Urgent",
    "messageCount": 12,
    "usageCount": 45,
    "lastUsed": "2025-02-17T11:00:00.000Z"
  }
}
```

### Initialize Default Labels

**POST** `/api/v2/labels/initialize`

Initialize default labels for user.

**Response:** `200 OK`

### Create Label Auto-Rule

**POST** `/api/v2/labels/:id/auto-rules`

Create an auto-labeling rule for a label.

**Request Body:**

```json
{
  "name": "Auto-label urgent emails",
  "condition": {
    "subject": "URGENT"
  },
  "confidence": 0.9,
  "isActive": true
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "rule": {
    "_id": "507f1f77bcf86cd799439025",
    "name": "Auto-label urgent emails",
    "isActive": true,
    "confidence": 0.9
  }
}
```

### Update Label Auto-Rule

**PUT** `/api/v2/labels/:id/auto-rules/:ruleId`

Update a label auto-rule.

**Request Body:**

```json
{
  "name": "Updated rule name",
  "confidence": 0.95,
  "isActive": false
}
```

**Response:** `200 OK`

### Delete Label Auto-Rule

**DELETE** `/api/v2/labels/:id/auto-rules/:ruleId`

Delete a label auto-rule.

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Auto-rule deleted successfully"
}
```

### Test Label Auto-Rule

**POST** `/api/v2/labels/:id/auto-rules/:ruleId/test`

Test an auto-rule to see how many messages it would match.

**Response:** `200 OK`

```json
{
  "success": true,
  "result": {
    "ruleId": "507f1f77bcf86cd799439025",
    "ruleName": "Auto-label urgent emails",
    "matchCount": 8,
    "condition": { "subject": "URGENT" },
    "confidence": 0.9
  }
}
```

---

## Advanced Search API

Base URL: `/api/v2/search/advanced`

### Execute Search

**GET** `/api/v2/search/advanced`

Search messages with advanced operators.

**Query Parameters:**

- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 25)
- `sortBy` (optional): Sort method (relevance, date, sender)

**Example Query:**

```
/api/v2/search/advanced?q=from:john@example.com is:unread after:2025-01-01&sortBy=date
```

**Response:** `200 OK`

```json
{
  "success": true,
  "results": [
    {
      "_id": "507f1f77bcf86cd799439019",
      "senderId": "john@example.com",
      "content": "Meeting tomorrow at 3pm",
      "createdAt": "2025-02-17T10:00:00.000Z"
    }
  ],
  "count": 1,
  "totalCount": 15,
  "page": 1,
  "pageSize": 25,
  "totalPages": 1,
  "query": "from:john@example.com is:unread",
  "parsedQuery": {
    "filters": {},
    "textSearch": [],
    "operators": []
  }
}
```

### Search Autocomplete

**GET** `/api/v2/search/advanced/autocomplete`

Get search suggestions.

**Query Parameters:**

- `q` (required): Search prefix

**Response:** `200 OK`

```json
{
  "success": true,
  "suggestions": [
    {
      "type": "operator",
      "value": "from:",
      "description": "Search operator: from:"
    }
  ],
  "count": 5
}
```

### Validate Query

**POST** `/api/v2/search/advanced/validate`

Validate search query syntax.

**Request Body:**

```json
{
  "query": "from:john@example.com is:unread"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "isValid": true,
  "errors": []
}
```

### Get Search Operators

**GET** `/api/v2/search/advanced/operators`

Get list of available search operators.

**Response:** `200 OK`

```json
{
  "success": true,
  "operators": [
    {
      "operator": "from:",
      "description": "Search by sender email",
      "example": "from:john@example.com",
      "category": "Sender/Recipient"
    }
  ],
  "count": 17
}
```

---

## Search Operators

### Sender/Recipient Operators

- `from:email` - Search by sender email
- `to:email` - Search by recipient email

### Content Operators

- `subject:keyword` - Search in subject
- `body:keyword` - Search in message body
- `text:keyword` - Search in any text

### Date Operators

- `before:YYYY-MM-DD` - Messages before date
- `after:YYYY-MM-DD` - Messages after date
- `date:YYYY-MM-DD` - Messages on specific date
- `older:30d` - Messages older than 30 days (supports d, w, m, y)
- `newer:7d` - Messages newer than 7 days

### Status Operators

- `is:read` - Read messages
- `is:unread` - Unread messages
- `is:starred` - Starred messages
- `is:archived` - Archived messages
- `is:sent` - Sent messages
- `is:draft` - Draft messages

### Attachment Operators

- `has:attachment` - Messages with attachments
- `has:image` - Messages with images
- `has:document` - Messages with documents
- `filename:*.pdf` - Specific filename pattern
- `larger:10mb` - Attachments larger than size
- `smaller:1mb` - Attachments smaller than size

### Organization Operators

- `folder:FolderName` - Messages in folder
- `label:LabelName` - Messages with label
- `thread:threadId` - Messages in thread

---

## Error Handling

All API endpoints return standard error responses:

**400 Bad Request**

```json
{
  "error": "Invalid request",
  "message": "Name is required"
}
```

**401 Unauthorized**

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**404 Not Found**

```json
{
  "error": "Not found",
  "message": "Folder not found"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

API requests are rate limited to:

- 100 requests per minute for read operations
- 30 requests per minute for write operations

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1677945600
```
