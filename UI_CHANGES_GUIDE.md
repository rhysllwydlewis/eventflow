# Messaging System UI Changes - Visual Guide

## Modal Footer - Before & After

### BEFORE: Text-only messaging

```
┌────────────────────────────────────────────────────────────────┐
│  Type your message...                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                                                          [Send]
```

### AFTER: With file attachments

```
┌────────────────────────────────────────────────────────────────┐
│  Type your message...                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                                                     📎    [Send]
                                                  [Attach]

When files selected:
┌────────────────────────────────────────────────────────────────┐
│  📄 document.pdf (2.5MB)                                    ✕  │
│  🖼️  image.jpg (1.2MB)                                       ✕  │
└────────────────────────────────────────────────────────────────┘
```

---

## Timestamp Display Examples

### BEFORE: Verbose format

```
Message from John
  "Hello, how are you?"
  17/02/2026, 10:00:55        ← Verbose, includes seconds

Message from Jane
  "I'm doing great!"
  17/02/2026, 10:05:23        ← Hard to scan quickly
```

### AFTER: Relative time format

```
Message from John
  "Hello, how are you?"
  Just now                     ← Clear and immediate

Message from Jane
  "I'm doing great!"
  5m ago                       ← Easy to understand

Message from Bob
  "See you tomorrow"
  2h ago                       ← Shows recent context

Message from Alice
  "Thanks for the update"
  3d ago                       ← Shows days for recent messages

Message from Charlie
  "Here's the document"
  Feb 14, 15:30                ← Shows date for older messages
```

---

## Complete Modal Layout

### Full Conversation Modal (After Implementation)

```
╔════════════════════════════════════════════════════════════════╗
║  Conversation                                              ✕   ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │  You                                                     │ ║
║  │  "Hi, I'd like to book your service"                    │ ║
║  │  Just now                                                │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                                ║
║       ┌──────────────────────────────────────────────────┐    ║
║       │  Supplier                                        │    ║
║       │  "Sure! What date works for you?"               │    ║
║       │  5m ago                                          │    ║
║       └──────────────────────────────────────────────────┘    ║
║                                                                ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │  You                                                     │ ║
║  │  "How about next Friday?"                               │ ║
║  │  2h ago                                                  │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                                ║
║       ┌──────────────────────────────────────────────────┐    ║
║       │  Supplier                                        │    ║
║       │  "Perfect! I've checked my calendar"            │    ║
║       │  Feb 17, 14:30                                   │    ║
║       └──────────────────────────────────────────────────┘    ║
║                                                                ║
║  [Typing indicator: Supplier is typing...]                    ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │  Type your message...                                    │ ║
║  │                                                          │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                   📎    [Send] ║
║                                                                ║
║  When files are selected:                                     ║
║  ┌────────────────────────────────────────────────────────┐   ║
║  │  📄 contract.pdf (2.5MB)                            ✕ │   ║
║  │  🖼️  venue_photo.jpg (1.2MB)                        ✕ │   ║
║  └────────────────────────────────────────────────────────┘   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## File Selection Flow

### Step 1: Click Paperclip Button

```
User clicks: 📎
↓
Operating system file picker opens
```

### Step 2: Select Files

```
File Picker
├── Documents/
│   ├── contract.pdf ✓ (selected)
│   ├── invoice.pdf ✓ (selected)
│   └── notes.txt ✗ (too large - warning shown)
└── Photos/
    └── photo.jpg ✓ (selected)
```

### Step 3: Files Validated

```
✅ contract.pdf - 2.5MB (valid)
✅ invoice.pdf - 3.2MB (valid)
✅ photo.jpg - 1.2MB (valid)
❌ notes.txt - 12MB (rejected: "File notes.txt is too large (max 10MB)")

Total: 6.9MB / 25MB ✓
```

### Step 4: Preview Displayed

```
┌────────────────────────────────────────────────────────────┐
│  📄 contract.pdf (2.5MB)                                ✕ │
│  📄 invoice.pdf (3.2MB)                                 ✕ │
│  🖼️  photo.jpg (1.2MB)                                  ✕ │
└────────────────────────────────────────────────────────────┘
```

### Step 5: Send Message

```
User types: "Here are the documents we discussed"
User clicks: [Send]
↓
FormData sent to backend:
  - conversationId
  - senderId
  - senderType
  - senderName
  - message: "Here are the documents we discussed"
  - attachments: [contract.pdf, invoice.pdf, photo.jpg]
↓
✅ Message sent successfully
Attachments cleared from preview
```

---

## Error Handling Examples

### File Too Large

```
User selects file: huge_video.mp4 (50MB)
↓
⚠️ Toast notification:
"File huge_video.mp4 is too large (max 10MB)"
↓
File is not added to selection
```

### Total Size Exceeded

```
User selects:
  - file1.pdf (8MB)
  - file2.pdf (9MB)
  - file3.pdf (10MB)
↓
✅ file1.pdf added (8MB)
✅ file2.pdf added (17MB total)
⚠️ Toast notification:
"Adding file3.pdf would exceed 25MB total limit. Some files were not added."
↓
Only file1.pdf and file2.pdf are added
```

### Send Error

```
User clicks [Send] with attachments
↓
❌ Server returns error 413 "Request too large"
↓
Toast notification:
"Failed to send message: Request too large"
↓
User can retry or remove some files
```

---

## Timestamp Scenarios

### Same Day Messages

```
09:00 - "Good morning!" → Just now (if current time is 09:00)
09:05 - "How are you?" → 5m ago (if current time is 09:05)
10:30 - "Great weather today" → 2h ago (if current time is 12:30)
```

### Recent Week Messages

```
Monday - "Let's schedule a meeting" → 2d ago (if today is Wednesday)
Friday - "Thanks for the info" → 5d ago (if today is Wednesday)
```

### Older Messages

```
Jan 15 - "Happy New Year!" → Jan 15, 10:30
Dec 25 - "Merry Christmas!" → Dec 25, 14:00
```

### Invalid Timestamps

```
null → "Unknown time"
undefined → "Unknown time"
"invalid date string" → "Unknown time"
```

---

## User Interactions

### Attach Files

1. Click 📎 button
2. Select files in OS dialog
3. See preview with file names and sizes
4. Optional: Remove files by clicking ✕
5. Type message (optional)
6. Click [Send]

### View Message Timestamps

1. Open conversation modal
2. Scroll through messages
3. See timestamps in consistent format:
   - Recent: relative time
   - Older: formatted date

### Send Attachment-Only Message

1. Click 📎 button
2. Select files
3. Leave message field empty
4. Click [Send]
5. Message sent with just attachments

---

## Responsive Design Notes

### Desktop (>768px)

```
┌────────────────────────────────────────────────┐
│  Message textarea (full width)                 │
│                                                │
└────────────────────────────────────────────────┘
                                      📎   [Send]
```

### Mobile (<768px)

```
┌─────────────────────┐
│  Message textarea   │
│  (full width)       │
│                     │
└─────────────────────┘

📎   [Send]
(buttons wrap to next line)
```

---

## Accessibility Features

### Keyboard Navigation

- Tab to navigate between:
  1. Message textarea
  2. Attach button
  3. Send button
  4. Remove attachment buttons
- Enter to send message
- Escape to close modal

### Screen Reader Support

- Attach button: "Attach files"
- Remove buttons: "Remove file [filename]"
- Preview: "Selected files: [count]"

### Visual Indicators

- Focus states on all interactive elements
- Clear button labels
- Icon + text for paperclip button
- High contrast colors for buttons

---

## Summary

This implementation provides:
✅ Intuitive file attachment UI
✅ Clear, readable timestamps
✅ Smooth user experience
✅ Proper validation and feedback
✅ Accessible design
✅ Mobile-friendly layout
