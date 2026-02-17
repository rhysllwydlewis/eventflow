# Phase 2: Messaging System User Guide

## Table of Contents

1. [Custom Message Folders](#custom-message-folders)
2. [Message Labels & Tags](#message-labels--tags)
3. [Advanced Search](#advanced-search)
4. [Conversation Grouping](#conversation-grouping)

---

## Custom Message Folders

### Overview

Organize your messages into custom folders just like traditional email. Create folders for projects, clients, categories, or any organizational structure that works for you.

### System Folders

EventFlow provides six default system folders:

- **📥 Inbox** - New incoming messages
- **📤 Sent** - Messages you've sent
- **📝 Drafts** - Unfinished messages
- **⭐ Starred** - Important flagged messages
- **📦 Archived** - Archived conversations
- **🗑️ Trash** - Deleted messages

### Creating Custom Folders

1. Click the **+ New Folder** button in the folder sidebar
2. Enter a folder name
3. Choose a color and icon (optional)
4. Select a parent folder for nesting (optional)
5. Click **Create Folder**

**Example folder structures:**

```
📁 Work
  ├── 📁 Project Alpha
  ├── 📁 Project Beta
  └── 📁 Team Updates

📁 Personal
  ├── 📁 Family
  └── 📁 Friends

📁 Finance
  ├── 📁 Invoices
  └── 📁 Receipts
```

### Moving Messages to Folders

**Method 1: Drag and Drop**

- Click and drag a message to any folder in the sidebar

**Method 2: Context Menu**

- Right-click on a message
- Select "Move to Folder"
- Choose the destination folder

**Method 3: Bulk Move**

- Select multiple messages using checkboxes
- Click the "Move" button in the toolbar
- Choose the destination folder

### Folder Settings

Right-click any folder and select **Settings** to configure:

**Auto-Archive**

- Automatically archive messages after X days
- Helps keep folders clean

**Notifications**

- Enable/disable notifications for messages in this folder
- Useful for low-priority folders

**Sort Order**

- By date (newest first)
- By sender (alphabetical)
- By subject (alphabetical)

### Nested Folders

Create subfolder hierarchies up to 5 levels deep:

1. Right-click a parent folder
2. Select "Create Subfolder"
3. Enter subfolder name and settings

**Tips:**

- Use colors to visually distinguish folder types
- Keep folder names short and descriptive
- Don't nest too deeply - 2-3 levels is usually sufficient

### Folder Rules (Advanced)

Automatically file messages based on rules:

1. Right-click a folder → **Manage Rules**
2. Click **Create Rule**
3. Define conditions:
   - From specific sender
   - Subject contains keywords
   - Has attachments
   - Date range
4. Choose action: Move or Copy
5. Enable rule and click **Save**

**Example Rules:**

```
Rule: "Auto-file client emails"
Condition: From contains "@acmeclient.com"
Action: Move to "Work/Client ACME"

Rule: "Archive old messages"
Condition: Older than 90 days
Action: Move to "Archived"
```

### Sharing Folders

Share folders with team members:

1. Right-click folder → **Share**
2. Enter email address
3. Choose permission level:
   - **View** - Can see messages only
   - **Manage** - Can organize and label messages
   - **Admin** - Can edit folder and rules
4. Click **Share**

### Best Practices

✅ **DO:**

- Use system folders as intended
- Create folders for major categories only
- Use labels for fine-grained organization
- Archive old conversations regularly
- Set up rules for repetitive tasks

❌ **DON'T:**

- Create too many folders (causes clutter)
- Delete system folders (they're protected)
- Nest folders more than 3 levels deep
- Share sensitive folders broadly

---

## Message Labels & Tags

### Overview

Labels are flexible tags you can apply to messages for organization and quick filtering. Unlike folders, a message can have multiple labels.

### Default Labels

EventFlow provides six starter labels:

- 🚨 **Urgent** - High priority items
- ⚠️ **Important** - Medium priority
- 💼 **Work** - Work-related
- 👤 **Personal** - Personal matters
- 💰 **Finance** - Money-related
- 🔄 **Follow Up** - Requires response

### Creating Labels

1. Click **Manage Labels** in the sidebar
2. Click **+ New Label**
3. Enter label name
4. Choose colors for text and background
5. Pick an emoji icon
6. Assign to a category (optional)
7. Click **Create**

**Color Guidelines:**

- Red (#EF4444) - Urgent, errors
- Orange (#F97316) - Important, warnings
- Yellow (#F59E0B) - Pending, finance
- Green (#10B981) - Success, completed
- Blue (#3B82F6) - Info, work
- Purple (#8B5CF6) - Creative, ideas

### Applying Labels

**Single Message:**

- Click the label icon on a message
- Select one or more labels from the list
- Or create a new label on-the-fly

**Multiple Messages:**

- Select messages using checkboxes
- Click **Apply Label** in toolbar
- Choose label(s) to apply

**Keyboard Shortcuts:**

- `L` - Open label menu
- `1-6` - Quick apply first 6 labels
- `Shift+L` - Remove all labels

### Label Filtering

Click any label in the sidebar to filter messages:

- Shows all messages with that label
- Works across all folders
- Combine with search for powerful queries

**Example Queries:**

```
label:Urgent is:unread          → Urgent unread messages
label:Work label:Important       → Work AND Important
label:Finance after:2025-01-01   → Finance since Jan 1
```

### Label Categories

Organize labels into categories:

- **Priority** - Urgent, Important, Low
- **Context** - Work, Personal, Travel
- **Topic** - Finance, Legal, Marketing
- **Action** - Follow Up, Review, Pending
- **Project** - Project A, Project B

### AI Label Suggestions

EventFlow can suggest labels based on message content:

1. Open a message
2. Click **Suggest Labels**
3. Review AI suggestions with confidence scores
4. Click suggestions to apply

**What AI considers:**

- Subject line keywords
- Message body content
- Sender patterns
- Your labeling history

### Bulk Label Operations

**Merge Labels:**

- Useful when you have duplicate labels
- Right-click label → **Merge with...**
- All messages updated automatically

**Rename Label:**

- Right-click label → **Rename**
- All messages keep the label

**Delete Label:**

- Right-click label → **Delete**
- Removes from all messages
- Cannot be undone

### Label Statistics

View label usage:

- Total message count
- Usage frequency
- Last used date
- Most common senders

Access via: Right-click label → **Statistics**

### Best Practices

✅ **DO:**

- Use labels for cross-cutting concerns
- Combine multiple labels on messages
- Use AI suggestions to save time
- Review and clean up labels quarterly
- Use categories for organization

❌ **DON'T:**

- Create too many labels (>20 becomes unwieldy)
- Duplicate labels with different names
- Use labels instead of folders for hierarchy
- Apply labels randomly

---

## Advanced Search

### Overview

Search messages using powerful operators and filters. Find exactly what you need in seconds.

### Basic Search

Type keywords in the search box:

```
meeting tomorrow
quarterly report
invoice #12345
```

### Search Operators

Combine operators for precise searches:

**Sender/Recipient:**

```
from:john@example.com              → From specific person
to:jane@example.com                → Sent to specific person
from:john to:jane                  → Conversation between two people
```

**Content:**

```
subject:meeting                    → Subject contains "meeting"
body:"project deadline"            → Exact phrase in body
text:budget                        → Anywhere in message
```

**Date:**

```
after:2025-01-01                   → Since January 1
before:2025-12-31                  → Before December 31
date:2025-02-14                    → On Valentine's Day
older:30d                          → Older than 30 days
newer:7d                           → Last 7 days
```

**Status:**

```
is:unread                          → Unread messages
is:starred                         → Starred/flagged
is:archived                        → Archived messages
is:draft                           → Draft messages
```

**Attachments:**

```
has:attachment                     → Any attachment
has:image                          → Has images
has:document                       → Has documents
filename:*.pdf                     → PDF files
filename:report*                   → Filename starts with "report"
larger:10mb                        → Files over 10MB
smaller:1mb                        → Files under 1MB
```

**Organization:**

```
folder:Work                        → In Work folder
label:Urgent                       → Has Urgent label
thread:abc123                      → In specific thread
```

### Complex Queries

Combine multiple operators:

```
from:john@example.com subject:invoice after:2025-01-01 has:attachment
→ Invoices from John since Jan 1 with attachments

is:unread folder:Work label:Urgent
→ Unread urgent work messages

from:sarah to:me older:30d is:unread
→ Unread messages from Sarah over 30 days old
```

### Boolean Logic

Use AND, OR, NOT:

```
subject:(meeting OR conference)
→ Subject has "meeting" or "conference"

from:john NOT label:Archived
→ From John, not archived

is:unread AND (folder:Work OR label:Urgent)
→ Unread work OR urgent messages
```

### Search Autocomplete

As you type, EventFlow suggests:

- Operators (from:, to:, is:)
- Recent searches
- Contact names
- Folder names
- Label names

Press `↓` or `↑` to navigate, `Enter` to select.

### Saved Searches

Save frequently used searches:

1. Perform a search
2. Click **Save Search**
3. Name your search
4. Access from sidebar under "Saved Searches"

**Useful Saved Searches:**

```
"Today's Unread"        → is:unread newer:1d
"Needs Response"        → is:unread label:"Follow Up"
"Large Attachments"     → has:attachment larger:10mb
"This Week's Work"      → folder:Work newer:7d
```

### Search Tips

**Performance:**

- More specific = faster results
- Use date ranges to limit scope
- Combine folder + other filters

**Accuracy:**

- Use quotes for exact phrases
- Wildcard \* matches any characters
- Case-insensitive by default

**Organization:**

- Save common searches
- Use labels for frequent topics
- Create folders for permanent categories

---

## Conversation Grouping

### Overview

Group and organize message lists by different attributes for better overview and bulk operations.

### Grouping Methods

#### 1. Group by Sender

```
John Doe (5 messages)
Jane Smith (3 messages)
Mike Johnson (2 messages)
```

**Best for:** Personal inbox, following up with specific people

#### 2. Group by Date

```
Today (8 messages)
Yesterday (3 messages)
This Week (12 messages)
Last Month (25 messages)
Older (142 messages)
```

**Best for:** Time-based workflows, recent activity

#### 3. Group by Status

```
New (5 messages)
Waiting Response (3 messages)
Resolved (12 messages)
```

**Best for:** Support tickets, task management

#### 4. Group by Label

```
Urgent (2 messages)
Finance (8 messages)
Project A (5 messages)
```

**Best for:** Project-based work, categorization

#### 5. Group by Folder

```
Inbox (15 messages)
Work (8 messages)
Archive (42 messages)
```

**Best for:** Folder-based organization

#### 6. Group by Priority

```
High (3 messages)
Normal (10 messages)
Low (25 messages)
```

**Best for:** Priority-based workflows

### Changing Grouping

1. Click the grouping dropdown in toolbar
2. Select grouping method
3. Optionally choose sort within groups
4. Click "Save Preference" to remember

### Group Actions

Perform actions on entire groups:

**Click group header ⋮ menu:**

- Mark all as read/unread
- Star all messages
- Apply label to all
- Move all to folder
- Archive all
- Delete all

### Collapsing Groups

- Click group header to collapse/expand
- Double-click to toggle
- Click "Collapse All" / "Expand All" in toolbar

### Sorting Within Groups

Each group can be sorted:

- By date (newest/oldest first)
- By sender (A-Z)
- By subject (A-Z)
- By size (largest/smallest first)

### Best Practices

✅ **DO:**

- Switch grouping based on task
- Use group actions for bulk operations
- Collapse groups you're not working on
- Save your preferred grouping

❌ **DON'T:**

- Use same grouping for all contexts
- Forget to expand groups (might miss messages)
- Apply group actions without reviewing

### Grouping + Search

Combine grouping with search for powerful workflows:

```
Search: is:unread folder:Work
Group by: Sender
→ See unread work messages grouped by who sent them

Search: label:Urgent
Group by: Date
→ See urgent items by when they arrived

Search: has:attachment larger:5mb
Group by: Sender
→ Find who's sending large files
```

---

## Keyboard Shortcuts

### Navigation

- `J` / `K` - Next/previous message
- `O` / `Enter` - Open message
- `U` - Return to message list
- `/` - Focus search box

### Actions

- `E` - Archive
- `S` - Star/unstar
- `R` - Reply
- `A` - Reply all
- `F` - Forward
- `L` - Apply label
- `M` - Move to folder
- `#` - Delete

### Selection

- `X` - Select message
- `* A` - Select all
- `* N` - Select none
- `* R` - Select read
- `* U` - Select unread

### Application

- `G I` - Go to Inbox
- `G S` - Go to Sent
- `G D` - Go to Drafts
- `?` - Show keyboard shortcuts

---

## Getting Help

- Visit the Help Center for video tutorials
- Contact support at support@eventflow.com
- Join our community forum for tips and tricks

---

**Last Updated:** February 17, 2025
**Version:** Phase 2.0
