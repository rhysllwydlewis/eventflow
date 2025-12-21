# 📸 EventFlow - Comprehensive Event Services Marketplace

A production-ready, feature-rich platform connecting event service suppliers (photographers, venues, caterers, entertainment, etc.) with customers planning events. Built with Node.js, Express, MongoDB, and modern web technologies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green)](https://www.mongodb.com/)

---

## 🚀 Quick Start - Production Deployment

**Deploying to production (Railway, Heroku, etc.)?** Follow these steps to avoid 502 errors:

### Prerequisites

- ✅ Node.js 16+
- ✅ **MongoDB Atlas account (free tier available)** ← Most important!
- ✅ Deployment platform account (Railway, Heroku, etc.)

### Essential Steps (15 minutes)

1. **Set up MongoDB Atlas** (Required - app won't start without this!)
   - 📚 **[Follow our simple step-by-step guide →](MONGODB_SETUP_SIMPLE.md)** (no technical knowledge needed)
   - 📚 Or see [MONGODB_SETUP.md](MONGODB_SETUP.md) for technical details
   - Get your connection string from MongoDB Atlas

2. **Configure Environment Variables** on your deployment platform:

   > **Note:** The MongoDB connection string should be configured as an environment variable in your deployment platform for security. Contact your administrator for the actual connection string, or set up your own MongoDB Atlas instance following the [MongoDB Setup Guide](MONGODB_SETUP.md).

   ```bash
   # Required
   MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/eventflow?retryWrites=true&w=majority
   JWT_SECRET=your-random-secret-min-32-chars
   NODE_ENV=production
   BASE_URL=https://your-app.railway.app

   # Recommended (optional)
   EMAIL_ENABLED=true
   FROM_EMAIL=no-reply@yourdomain.com
   SENDGRID_API_KEY=your-api-key
   ```

3. **Deploy your app** - Push to your platform (Railway, Heroku, etc.)

4. **Verify it works** - Visit `https://your-app.railway.app/api/health`
   - Should show `"databaseStatus": "connected"`

### Troubleshooting 502 Errors

Getting "502 Bad Gateway" or "connection refused" errors? This usually means MongoDB isn't configured:

| Error Message                                   | Solution                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "Invalid scheme, expected connection string..." | You're using the placeholder from `.env.example`. Get your real connection string from MongoDB Atlas - [see guide](MONGODB_SETUP_SIMPLE.md) |
| "Authentication failed" or "bad auth"           | Wrong password in connection string. Reset it in MongoDB Atlas → Database Access                                                            |
| "Connection timeout" or "ENOTFOUND"             | IP not whitelisted. Add `0.0.0.0/0` in MongoDB Atlas → Network Access                                                                       |
| "No cloud database configured"                  | `MONGODB_URI` environment variable not set on your deployment platform                                                                      |

**📚 Detailed troubleshooting:** See [MONGODB_SETUP_SIMPLE.md](MONGODB_SETUP_SIMPLE.md#common-problems-and-solutions)

---

## 🌟 Features

### Core Platform

- ✅ **Advanced Photo Management** - Upload, optimize, crop with AWS S3 or local storage
- ✅ **Reviews & Ratings System** - 5-star ratings with approval workflow
- ✅ **Advanced Search & Discovery** - Full-text search, filters, trending, recommendations
- ✅ **User Authentication** - JWT-based auth with role-based access (customer, supplier, admin)
- ✅ **Supplier Profiles** - Rich profiles with galleries, packages, and services
- ✅ **Admin Moderation** - Photo and review approval queues
- ✅ **MongoDB Integration** - Schema validation, indexes, connection pooling
- ✅ **API Documentation** - Interactive Swagger UI at `/api-docs`

### Photo Management

- Multer middleware for secure uploads
- Sharp for image optimization (resize, compress, format conversion)
- Automatic thumbnail generation (300x300, 1200x1200, 2000x2000)
- AWS S3 cloud storage or local filesystem
- Batch upload (up to 10 photos)
- Image cropping and editing
- Admin approval workflow
- CDN-ready URLs

### Search & Discovery

- Full-text search across suppliers
- Advanced filters: category, location, price, rating, amenities, guest capacity
- Trending suppliers
- New arrivals
- Popular packages
- Personalized recommendations based on browsing history
- Search history tracking

### Reviews & Ratings

- 5-star rating system
- Written reviews with event details
- Admin moderation
- Helpful/unhelpful voting
- Rating distribution analytics
- Verified reviews

### Admin Dashboard

- **User Management** - Edit, delete, suspend, ban users
- **Admin Privilege Control** - Grant/revoke admin access with owner protection
- **Supplier Management** - Edit, approve, verify, delete suppliers
- **Package Management** - Edit, approve, feature, delete packages
- **Photo Moderation** - Batch approve/reject photo uploads
- **Review Moderation** - Approve/reject customer reviews
- **Comprehensive Audit Log** - Track all admin actions with timestamps
- **Data Export** - CSV and JSON exports for users, marketing lists, full database
- **Analytics Dashboard** - User signups, activity metrics, platform statistics
- **GDPR Compliance** - User data management and privacy controls

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- **MongoDB Atlas** (cloud database) - **Recommended for production** (free tier available)
- **Optional:** Local MongoDB 6.0+ for development

**Note:** EventFlow is configured to use MongoDB Atlas as the primary database. For development, it can fall back to file-based JSON storage. For production deployments, MongoDB Atlas is strongly recommended - see [MONGODB_SETUP.md](MONGODB_SETUP.md).

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/eventflow.git
cd eventflow

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB Atlas connection string
# The .env.example file includes a working MongoDB connection string

# Start server
npm start

# Optional: Migrate existing data to MongoDB (if you have local JSON data)
# npm run migrate
```

Visit http://localhost:3000

**Important:** For production deployments, configure your MongoDB Atlas connection string in the `MONGODB_URI` environment variable. See the [MongoDB Setup Guide](MONGODB_SETUP.md) for detailed instructions.

### Docker Quick Start

```bash
# Start all services (app + MongoDB + Mongo Express)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services:**

- App: http://localhost:3000
- API Docs: http://localhost:3000/api-docs
- MongoDB UI: http://localhost:8081

See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for details.

## 📚 Documentation

### Getting Started

- **[Production Deployment Quick Start](#-quick-start---production-deployment)** - Deploy in 15 minutes
- **[MongoDB Setup (Simple Guide)](MONGODB_SETUP_SIMPLE.md)** - For non-technical users
- **[Troubleshooting 502 Errors](#troubleshooting-502-errors)** - Common deployment issues

### Complete Guides

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Firebase Storage Guide](FIREBASE_STORAGE_GUIDE.md)** - Using Firebase as primary storage (database + files)
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[MongoDB Setup (Technical)](MONGODB_SETUP.md)** - Database configuration guide
- **[Docker Guide](DOCKER_GUIDE.md)** - Docker Compose usage
- **[Interactive API Docs](http://localhost:3000/api-docs)** - Swagger UI (when running)

## 🛠️ Tech Stack

**Backend:**

- Node.js & Express.js
- MongoDB with Mongoose schemas
- Firebase (Authentication, Firestore, Storage, Analytics)
- JWT authentication
- Multer (file uploads)
- Sharp (image processing)
- AWS SDK (S3 storage)

**Email:**

- SendGrid or SMTP
- Nodemailer

**Security:**

- Helmet (security headers)
- bcrypt (password hashing)
- Rate limiting
- Input validation (Validator.js)

**Documentation:**

- Swagger/OpenAPI 3.0
- Swagger UI Express

**Optional:**

- Stripe (payments)
- OpenAI (AI features)

## 📖 API Endpoints

### Authentication

```
POST   /api/auth/register        - Register new user
POST   /api/auth/login           - Login
POST   /api/auth/logout          - Logout
GET    /api/auth/me              - Get current user
POST   /api/auth/forgot          - Request password reset
```

### Search & Discovery

```
GET    /api/search/suppliers     - Advanced supplier search
GET    /api/search/categories    - Get all categories
GET    /api/search/amenities     - Get all amenities
GET    /api/discovery/trending   - Trending suppliers
GET    /api/discovery/new        - New suppliers
GET    /api/discovery/recommendations - Personalized recommendations
```

### Reviews & Ratings

```
POST   /api/reviews              - Create review
GET    /api/reviews/supplier/:id - Get supplier reviews
GET    /api/reviews/supplier/:id/distribution - Rating distribution
POST   /api/reviews/:id/helpful  - Mark review helpful
DELETE /api/reviews/:id          - Delete review
```

### Photo Management

```
POST   /api/photos/upload        - Upload single photo
POST   /api/photos/upload/batch  - Upload multiple photos
DELETE /api/photos/delete        - Delete photo
POST   /api/photos/crop          - Crop image
GET    /api/photos/pending       - Get pending photos (admin)
POST   /api/photos/approve       - Approve/reject photo (admin)
```

### Admin Endpoints

```
GET    /api/admin/users          - List all users
PUT    /api/admin/users/:id      - Edit user profile
DELETE /api/admin/users/:id      - Delete user
POST   /api/admin/users/:id/grant-admin   - Grant admin privileges
POST   /api/admin/users/:id/revoke-admin  - Revoke admin privileges
GET    /api/admin/suppliers      - List all suppliers
PUT    /api/admin/suppliers/:id  - Edit supplier
DELETE /api/admin/suppliers/:id  - Delete supplier
GET    /api/admin/packages       - List all packages
PUT    /api/admin/packages/:id   - Edit package
DELETE /api/admin/packages/:id   - Delete package
GET    /api/admin/metrics        - Get dashboard metrics
GET    /api/admin/users-export   - Export users (CSV)
GET    /api/admin/export/all     - Export all data (JSON)
```

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete reference.  
See [ADMIN_API.md](ADMIN_API.md) for detailed admin endpoint documentation.

## 🔧 Environment Variables

**Required for Production:**

```env
# Database - MOST IMPORTANT! App won't start without this
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/eventflow
# 👆 Get this from MongoDB Atlas - see MONGODB_SETUP_SIMPLE.md

# Security
JWT_SECRET=your-secret-key-min-32-chars

# Environment
NODE_ENV=production
BASE_URL=https://yourdomain.com
```

**Recommended (Email functionality):**

```env
EMAIL_ENABLED=true
FROM_EMAIL=no-reply@yourdomain.com
SENDGRID_API_KEY=SG.your-api-key
```

**Optional - AWS S3:**

```env
AWS_S3_BUCKET=your-bucket
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

**⚠️ Common mistake:** Using the placeholder value from `.env.example` will cause 502 errors!  
Get your real connection string: **[MongoDB Setup Guide](MONGODB_SETUP_SIMPLE.md)**

See [.env.example](.env.example) for all options.

## 🔥 Firebase Setup

**Firebase is the primary cloud storage solution for EventFlow** - storing all application data (users, packages, posts, reviews) in Firestore and all media files (photos, images) in Firebase Storage. The system is pre-configured to use Firebase first, with automatic fallback to MongoDB or local storage if Firebase is not available.

EventFlow includes Firebase integration for authentication, real-time database (Firestore), cloud storage, and analytics. Firebase is already configured and ready to use.

📖 **See [FIREBASE_STORAGE_GUIDE.md](FIREBASE_STORAGE_GUIDE.md) for complete setup instructions and troubleshooting.**

### Quick Start

1. **Firebase is pre-configured** with the EventFlow project:
   - Project ID: `eventflow-ffb12`
   - Already initialized in the codebase
   - Configuration files are ready to use

2. **Two Configuration Files Available:**
   - **For npm/build tools (Vite, Webpack, etc.):**

     ```javascript
     // Use npm package imports
     import { auth, db } from './src/config/firebase.js';
     // Or alternative path:
     import { auth, db } from './src/firebase.js';
     ```

   - **For browser (no build step):**
     ```javascript
     // Uses CDN imports (already in use)
     import { auth, db } from '/assets/js/firebase-config.js';
     ```

3. **Available Services:**
   - **Authentication** (`auth`) - User sign-in/sign-up with email/password
   - **Firestore** (`db`) - Real-time NoSQL database
   - **Storage** - File and image uploads (configured in `firebase-config.js`)
   - **Analytics** (optional) - User engagement tracking

### Usage Examples

**Authentication:**

```javascript
import { auth } from './src/config/firebase.js';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Sign in user
const userCredential = await signInWithEmailAndPassword(auth, email, password);
console.log('User:', userCredential.user);
```

**Firestore Database:**

```javascript
import { db } from './src/config/firebase.js';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// Add a document
const docRef = await addDoc(collection(db, 'events'), {
  title: 'Wedding',
  date: '2024-06-15',
  location: 'London',
});

// Get all documents
const querySnapshot = await getDocs(collection(db, 'events'));
querySnapshot.forEach(doc => {
  console.log(doc.id, '=>', doc.data());
});
```

### Environment Variables (Optional)

While Firebase is pre-configured, you can optionally override settings using environment variables:

```env
FIREBASE_API_KEY=AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc
FIREBASE_AUTH_DOMAIN=eventflow-ffb12.firebaseapp.com
FIREBASE_PROJECT_ID=eventflow-ffb12
FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=253829522456
FIREBASE_APP_ID=1:253829522456:web:3fae1bcec63932321bcf6d
FIREBASE_MEASUREMENT_ID=G-JRT11771YD
```

### Security Notes

- **API keys are safe to expose** - Firebase API keys are public identifiers
- Security is enforced through **Firestore Security Rules** and **Storage Rules**
- See `firestore.rules` and `storage.rules` for access control configuration
- Never expose Firebase Admin SDK credentials (service account keys) in client code

### For Backend (Node.js)

Use Firebase Admin SDK for server-side operations:

```javascript
const { getFirestore } = require('./firebase-admin.js');
const db = getFirestore();

// Server-side database operations
const snapshot = await db.collection('events').get();
```

See `firebase-admin.js` for backend Firebase configuration.

### Firebase as Primary Storage

**EventFlow is configured to use Firebase as the primary cloud storage solution:**

1. **Database (Firestore)**: The system automatically prioritizes Firebase Firestore over MongoDB and local storage
   - All data (users, packages, posts, reviews, etc.) stored in Firestore
   - Configured in `db-unified.js` to try Firestore first
   - Set `FIREBASE_PROJECT_ID` or `FIREBASE_SERVICE_ACCOUNT_KEY` in environment variables

2. **File Storage**: Photos and media files are stored in Firebase Storage
   - Supplier photos use Firebase Storage (`supplier-photo-upload.js`)
   - Storage bucket: `eventflow-ffb12.firebasestorage.app`
   - Set `STORAGE_TYPE=firebase` in `.env` (already default)

3. **Production Setup**: To use Firebase in production:

   ```env
   # Required: Firebase Project ID
   FIREBASE_PROJECT_ID=eventflow-ffb12

   # Required for production: Service Account Key (download from Firebase Console)
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"eventflow-ffb12",...}'

   # Storage Configuration
   STORAGE_TYPE=firebase
   FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
   ```

4. **How it works**:
   - On startup, `db-unified.js` attempts Firebase Firestore connection first
   - If Firebase is available, all database operations use Firestore
   - If not configured, falls back to MongoDB, then local files (dev only)
   - Check logs on startup for: `✅ Using Firebase Firestore for data storage`

**To verify Firebase is active**: Check server logs after starting the app. You should see "Using Firebase Firestore for data storage" instead of "Using local file storage".

## 📁 Project Structure

```
eventflow/
├── src/                # Source modules (npm imports)
│   ├── config/        # Configuration files
│   │   └── firebase.js # Firebase config (npm package)
│   └── firebase.js    # Firebase re-export (convenience)
├── middleware/         # Reusable middleware functions
│   ├── auth.js        # Authentication & authorization
│   ├── validation.js  # Input validation helpers
│   └── rateLimit.js   # Rate limiting configuration
├── routes/            # Modular route handlers
│   ├── auth.js        # Authentication routes
│   └── admin.js       # Admin-only routes
├── models/            # Database models and schemas
├── public/            # Frontend assets
│   ├── assets/
│   │   ├── css/      # Stylesheets
│   │   └── js/       # JavaScript modules
│   │       └── firebase-config.js # Firebase config (CDN)
│   └── *.html        # Page templates
├── data/             # JSON data storage (development)
├── firebase-admin.js # Firebase Admin SDK (backend)
├── photo-upload.js   # Photo upload utilities
├── reviews.js        # Reviews system module
├── search.js         # Search & discovery module
├── websocket-server.js # Real-time WebSocket server
├── server.js         # Main application server
└── package.json      # Dependencies and scripts
```

## 🗄️ Database Schema

**Collections:**

- `users` - Customer, supplier, admin accounts
- `suppliers` - Supplier business profiles
- `packages` - Service packages
- `reviews` - Supplier reviews and ratings
- `messages` - Customer-supplier messages
- `threads` - Message conversations
- `plans` - Customer event plans
- `notes` - Customer planning notes
- `events` - Event records
- `searchHistory` - User search history

All collections have:

- JSON schema validation
- Optimized indexes
- Automatic timestamps

## 🚢 Deployment

**⚠️ First-time deploying?** See the [Production Quick Start](#-quick-start---production-deployment) section at the top!

### Railway

```bash
railway login
railway init
# Set environment variables (use your REAL MongoDB connection string!)
railway variables set JWT_SECRET="..." MONGODB_URI="mongodb+srv://..."
railway up
```

### Heroku

```bash
heroku create eventflow-app
# Set environment variables (use your REAL MongoDB connection string!)
heroku config:set JWT_SECRET="..." MONGODB_URI="mongodb+srv://..."
git push heroku main
```

### DigitalOcean App Platform

```bash
# Configure via dashboard or doctl CLI
doctl apps create --spec .do/app.yaml
```

### AWS EC2 / VPS

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run linter
npm run lint

# Security audit
npm audit
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Image processing by [Sharp](https://sharp.pixelplumbing.com/)
- File uploads with [Multer](https://github.com/expressjs/multer)
- Database: [MongoDB](https://www.mongodb.com/)

## 📞 Support

- 📧 Email: support@eventflow.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/eventflow/issues)
- 📖 Docs: [Documentation](API_DOCUMENTATION.md)

## 📚 Documentation

- **[README.md](README.md)** - Overview and quick start
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** - Admin dashboard user guide
- **[ADMIN_API.md](ADMIN_API.md)** - Admin API endpoint documentation
- **[GDPR_COMPLIANCE.md](GDPR_COMPLIANCE.md)** - Data protection and privacy
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment
- **[MONGODB_SETUP.md](MONGODB_SETUP.md)** - Database configuration
- **[AWS_SES_SETUP.md](AWS_SES_SETUP.md)** - Email service setup
- **[2FA_IMPLEMENTATION.md](2FA_IMPLEMENTATION.md)** - Two-factor auth (planned)

---

**Version:** v16.3.9 | **Status:** Production Ready ✅
