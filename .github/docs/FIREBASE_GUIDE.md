# Firebase Cloud Integration Guide for EventFlow

This guide explains how to set up and use the Firebase cloud-based infrastructure for EventFlow.

## Overview

EventFlow now supports Firebase for cloud-based data storage and real-time features:

- **Firestore Database**: Stores packages, suppliers, customers, tickets, and messages
- **Firebase Storage**: Hosts package images, supplier logos, and user avatars
- **Firebase Authentication**: Manages user authentication (Email/Password)
- **Real-time Updates**: Live synchronization of messages and tickets

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Project name: `eventflow-ffb12` (or your own name)
4. Follow the setup wizard
5. Enable Google Analytics (optional)

### 2. Enable Firebase Services

#### Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Select **Start in production mode**
4. Choose a location closest to your users
5. Click **Enable**

#### Enable Firebase Storage

1. In Firebase Console, go to **Storage**
2. Click **Get started**
3. Use default security rules (we'll update them later)
4. Choose same location as Firestore
5. Click **Done**

#### Enable Firebase Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Email/Password**
5. Click **Save**

### 3. Get Firebase Configuration

1. In Firebase Console, go to **Project settings** (gear icon)
2. Scroll down to **Your apps**
3. Click the **Web** icon (`</>`)
4. Register your app with nickname: `EventFlow`
5. Copy the Firebase configuration object

The configuration should look like this:

```javascript
const firebaseConfig = {
  apiKey: 'AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc',
  authDomain: 'eventflow-ffb12.firebaseapp.com',
  projectId: 'eventflow-ffb12',
  storageBucket: 'eventflow-ffb12.firebasestorage.app',
  messagingSenderId: '253829522456',
  appId: '1:253829522456:web:3fae1bcec63932321bcf6d',
  measurementId: 'G-JRT11771YD',
};
```

### 4. Update Environment Variables

Update your `.env` file with Firebase credentials:

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc
FIREBASE_AUTH_DOMAIN=eventflow-ffb12.firebaseapp.com
FIREBASE_PROJECT_ID=eventflow-ffb12
FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=253829522456
FIREBASE_APP_ID=1:253829522456:web:3fae1bcec63932321bcf6d
FIREBASE_MEASUREMENT_ID=G-JRT11771YD

# Set storage type to Firebase
STORAGE_TYPE=firebase
```

### 5. Deploy Security Rules

#### Deploy Firestore Rules

1. In Firebase Console, go to **Firestore Database**
2. Click **Rules** tab
3. Copy content from `firestore.rules` file
4. Paste into the rules editor
5. Click **Publish**

Or use Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

#### Deploy Storage Rules

1. In Firebase Console, go to **Storage**
2. Click **Rules** tab
3. Copy content from `storage.rules` file
4. Paste into the rules editor
5. Click **Publish**

Or use Firebase CLI:

```bash
firebase deploy --only storage:rules
```

## Features

### 1. Package Management (Admin)

Admins can now:

- **Add packages** with drag-and-drop image upload
- **Edit packages** and replace images
- Upload images to Firebase Storage
- Store package data in Firestore
- View real-time package updates

**How to use:**

1. Go to `/admin-packages.html`
2. Click **Add Package** button
3. Select a supplier from dropdown
4. Fill in package details
5. Drag & drop an image or click to browse
6. Click **Save Package**

Images are automatically uploaded to Firebase Storage at:

```
/packages/{packageId}/{imageName}
```

### 2. Ticketing System

Three types of users can create and view tickets:

#### Customer Tickets

1. Go to **Customer Dashboard** (`/dashboard-customer.html`)
2. Click **Create Ticket** button
3. Fill in subject, message, and priority
4. Click **Submit Ticket**
5. View all your tickets in the dashboard
6. Click a ticket to see admin responses

#### Supplier Tickets

1. Go to **Supplier Dashboard** (`/dashboard-supplier.html`)
2. Click **Create Ticket** button
3. Fill in subject, message, and priority
4. Click **Submit Ticket**
5. View all your tickets in the dashboard
6. Click a ticket to see admin responses

#### Admin Ticket Management

1. Go to **Admin Tickets** (`/admin-tickets.html`)
2. View all tickets from customers and suppliers
3. Filter by status: All, Open, In Progress, Resolved, Closed
4. Click a ticket to:
   - View details and message
   - Change status using dropdown
   - Add responses to ticket
5. Real-time updates when new tickets arrive

**Ticket Statuses:**

- `open` - New ticket, needs attention
- `in_progress` - Admin is working on it
- `resolved` - Issue resolved
- `closed` - Ticket closed

**Priority Levels:**

- `low` - General questions
- `medium` - Normal issues
- `high` - Urgent problems

### 3. Customer-Supplier Messaging

Enables direct communication between customers and suppliers.

#### Starting a Conversation (Customer)

1. Go to a supplier page (`/supplier.html?id=...`)
2. Click **Start Conversation** button
3. Type your message
4. Click **Send Message**
5. Message is stored in Firebase
6. Go to **Customer Dashboard** to continue conversation

#### Viewing Messages (Supplier)

1. Go to **Supplier Dashboard** (`/dashboard-supplier.html`)
2. View **Messages** section
3. See all conversations with customers
4. Click a conversation to:
   - View message history
   - Send replies
   - Real-time updates when customer sends new messages

**Message Structure in Firestore:**

```
conversations/{conversationId}/
  - customerId: string
  - customerName: string
  - supplierId: string
  - supplierName: string
  - lastMessage: string
  - lastMessageTime: timestamp
  - messages (subcollection)/
      {messageId}/
        - senderId: string
        - senderType: "customer" | "supplier"
        - senderName: string
        - message: string
        - timestamp: timestamp
        - read: boolean
```

### 4. Real-time Updates

All Firebase features support real-time updates:

- **Tickets**: Automatically update when admin responds
- **Messages**: New messages appear instantly
- **Packages**: Package list updates when admin adds/edits

Real-time listeners are automatically set up and cleaned up.

## Firebase Collections

### packages

Stores package information:

```javascript
{
  id: "pkg_...",
  supplierId: "sup_...",
  title: "Wedding Package Deluxe",
  description: "Complete wedding package...",
  price_display: "From £2,500",
  image: "https://firebasestorage.googleapis.com/...",
  approved: true,
  featured: false,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:30:00Z"
}
```

### tickets

Stores support tickets:

```javascript
{
  id: "tkt_...",
  senderId: "usr_...",
  senderType: "customer", // or "supplier"
  senderName: "John Smith",
  senderEmail: "john@example.com",
  subject: "Question about pricing",
  message: "I would like to know...",
  status: "open", // open | in_progress | resolved | closed
  priority: "medium", // low | medium | high
  createdAt: Timestamp,
  updatedAt: Timestamp,
  responses: [
    {
      responderId: "admin_...",
      responderType: "admin",
      responderName: "Admin",
      message: "Thank you for your question...",
      timestamp: Timestamp
    }
  ]
}
```

### conversations

Stores customer-supplier conversations:

```javascript
{
  id: "{customerId}_{supplierId}",
  customerId: "usr_...",
  customerName: "John Smith",
  supplierId: "sup_...",
  supplierName: "ABC Venues",
  lastMessage: "Are you available on...",
  lastMessageTime: Timestamp,
  createdAt: Timestamp
}
```

With messages subcollection at `conversations/{id}/messages/`:

```javascript
{
  id: "msg_...",
  senderId: "usr_...",
  senderType: "customer", // or "supplier"
  senderName: "John Smith",
  message: "Are you available on June 15th?",
  timestamp: Timestamp,
  read: false
}
```

## Troubleshooting

### Firebase not loading

**Problem**: "Firebase is not defined" error

**Solution**:

1. Check that `firebase-config.js` is loaded as a module:
   ```html
   <script type="module" src="/assets/js/firebase-config.js"></script>
   ```
2. Ensure Firebase credentials are correct in config file
3. Check browser console for network errors

### Images not uploading

**Problem**: Image upload fails

**Solution**:

1. Check Storage security rules allow uploads
2. Ensure file size is under 5MB
3. Verify file is an image type (JPG, PNG, GIF)
4. Check Firebase Storage is enabled in console

### Tickets not appearing

**Problem**: Tickets don't show in dashboard

**Solution**:

1. Check Firestore security rules allow read/write
2. Verify user is authenticated
3. Check browser console for errors
4. Ensure Firestore is enabled in Firebase Console

### Real-time updates not working

**Problem**: Messages/tickets don't update automatically

**Solution**:

1. Check that listeners are set up correctly
2. Verify Firestore security rules allow read access
3. Check browser console for listener errors
4. Ensure no ad blockers are interfering

## Development vs Production

### Development Mode

- Uses hardcoded Firebase config in `firebase-config.js`
- All data stored in Firebase
- Real-time features enabled

### Production Mode

1. Update `firebase-config.js` with your own Firebase credentials
2. Deploy Firestore and Storage security rules
3. Set up Firebase Authentication
4. Configure Firebase project settings
5. Update environment variables

## Security Best Practices

1. **Never commit Firebase credentials** to public repositories
2. **Use environment variables** for sensitive config
3. **Deploy security rules** before going live
4. **Enable authentication** for all write operations
5. **Validate file uploads** (size, type, content)
6. **Limit query results** to prevent excessive reads
7. **Monitor Firebase usage** to avoid unexpected costs

## Firebase Pricing

Firebase offers a generous free tier:

- **Firestore**: 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day
- **Storage**: 5GB stored, 1GB/day downloaded
- **Authentication**: Unlimited users

For production use with higher traffic, consider upgrading to Blaze (Pay as you go) plan.

## Support

For Firebase-specific issues:

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Community](https://firebase.google.com/support)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase)

For EventFlow issues:

- Check the console for error messages
- Review Firestore and Storage security rules
- Verify Firebase services are enabled
- Contact support team

## Next Steps

1. **Test all features** in development
2. **Deploy security rules** to production
3. **Monitor Firebase usage** in console
4. **Set up Firebase Analytics** (optional)
5. **Configure backup** for Firestore data
6. **Enable Firebase Performance Monitoring** (optional)
