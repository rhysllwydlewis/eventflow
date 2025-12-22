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
   - 📚 **[Follow our simple step-by-step guide →](.github/docs/MONGODB_SETUP_SIMPLE.md)** (no technical knowledge needed)
   - 📚 Or see [MONGODB_SETUP.md](.github/docs/MONGODB_SETUP.md) for technical details
   - Get your connection string from MongoDB Atlas

2. **Configure Environment Variables** on your deployment platform:

   ```bash
   # Required
   MONGODB_URI=mongodb+srv://your-actual-connection-string
   JWT_SECRET=your-random-secret-min-32-chars
   NODE_ENV=production
   BASE_URL=https://event-flow.co.uk

   # Recommended (optional)
   EMAIL_ENABLED=true
   FROM_EMAIL=no-reply@yourdomain.com
   SENDGRID_API_KEY=your-api-key
   ```

3. **Deploy your app** - Push to your platform (Railway, Heroku, etc.)

4. **Verify it works** - Visit `https://event-flow.co.uk/api/health`
   - Should show `"databaseStatus": "connected"`

### Troubleshooting 502 Errors

Getting "502 Bad Gateway" or "connection refused" errors? This usually means MongoDB isn't configured:

| Error Message                                   | Solution                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Invalid scheme, expected connection string..." | You're using the placeholder from `.env.example`. Get your real connection string from MongoDB Atlas - [see guide](.github/docs/MONGODB_SETUP_SIMPLE.md) |
| "Authentication failed" or "bad auth"           | Wrong password in connection string. Reset it in MongoDB Atlas → Database Access                                                                         |
| "Connection timeout" or "ENOTFOUND"             | IP not whitelisted. Add `0.0.0.0/0` in MongoDB Atlas → Network Access                                                                                    |
| "No cloud database configured"                  | `MONGODB_URI` environment variable not set on your deployment platform                                                                                   |

**📚 Detailed troubleshooting:** See [MONGODB_SETUP_SIMPLE.md](.github/docs/MONGODB_SETUP_SIMPLE.md#common-problems-and-solutions)

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
- **Optional:** MongoDB 6.0+ (local or Atlas) for production deployments

**Note:** EventFlow uses file-based JSON storage by default for zero-configuration setup. MongoDB is available for production use - see [MONGODB_SETUP.md](.github/docs/MONGODB_SETUP.md).

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/eventflow.git
cd eventflow

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration (MongoDB is optional)

# Start server (no migration needed for file-based storage)
npm start

# Optional: Migrate to MongoDB (for production)
# npm run migrate
```

Visit http://localhost:3000

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
- **[MongoDB Setup (Simple Guide)](.github/docs/MONGODB_SETUP_SIMPLE.md)** - For non-technical users
- **[Troubleshooting 502 Errors](#troubleshooting-502-errors)** - Common deployment issues

### Complete Guides

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[MongoDB Setup (Technical)](.github/docs/MONGODB_SETUP.md)** - Database configuration guide
- **[Docker Guide](DOCKER_GUIDE.md)** - Docker Compose usage
- **[Interactive API Docs](http://localhost:3000/api-docs)** - Swagger UI (when running)

## 🛠️ Tech Stack

**Backend:**

- Node.js & Express.js
- MongoDB with Mongoose schemas
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
# 👆 Get this from MongoDB Atlas - see .github/docs/MONGODB_SETUP_SIMPLE.md

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
Get your real connection string: **[MongoDB Setup Guide](.github/docs/MONGODB_SETUP_SIMPLE.md)**

See [.env.example](.env.example) for all options.

### Database Configuration

**EventFlow uses MongoDB Atlas as the primary database for production deployments:**

1. **MongoDB Atlas (PRIMARY - Recommended for Production)**
   - The system automatically prioritizes MongoDB over local storage
   - All data (users, packages, posts, reviews, etc.) stored in MongoDB Atlas
   - Configured in `db-unified.js` to try MongoDB first
   - Set `MONGODB_URI` in environment variables with your Atlas connection string

   **Setup Instructions:**
   - Create a free MongoDB Atlas account at https://cloud.mongodb.com/
   - Follow the [MongoDB Setup Guide](.github/docs/MONGODB_SETUP_SIMPLE.md) for step-by-step instructions
   - Get your connection string and configure it in Railway or your hosting platform
   - **Important**: Never commit your actual connection string to git

   ```env
   # Production MongoDB Configuration
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=eventflow
   ```

2. **Local Storage (Development Only)**
   - If MongoDB is not configured, falls back to local file storage
   - **Not suitable for production** - data is stored in JSON files
   - Useful for quick local development and testing

3. **File Storage (Photos & Media)**
   - Photos and media files are stored locally or in S3
   - Supplier photos are uploaded via the photo upload system
   - Set `STORAGE_TYPE` in `.env` (local or s3)

   ```env
   # Storage Configuration
   STORAGE_TYPE=local  # or 's3' for AWS S3
   ```

4. **How Database Priority Works**:
   - On startup, `db-unified.js` attempts MongoDB connection first (PRIMARY)
   - If MongoDB is not available, falls back to local files (dev only)
   - Check logs on startup for connection status:
     - `✅ Using MongoDB for data storage (PRIMARY)` - Production ready
     - `⚠️  Using local file storage` - Development only, not for production

**To verify your database is connected**: Check server logs after starting the app, or visit `/api/health` endpoint. You should see MongoDB status, not local storage in production.

**Production Deployment Checklist**:

- ✅ MongoDB Atlas account created and cluster configured
- ✅ Database user with read/write permissions created
- ✅ Network access configured (IP whitelist or allow all)
- ✅ `MONGODB_URI` environment variable set in Railway/hosting platform
- ✅ Connection string uses actual credentials (not placeholders)
- ✅ Never commit real credentials to git - use environment variables only

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
│   └── *.html        # Page templates
├── data/             # JSON data storage (development)
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
- **[MONGODB_SETUP.md](.github/docs/MONGODB_SETUP.md)** - Database configuration
- **[AWS_SES_SETUP.md](AWS_SES_SETUP.md)** - Email service setup
- **[2FA_IMPLEMENTATION.md](2FA_IMPLEMENTATION.md)** - Two-factor auth (planned)

---

**Version:** v16.3.9 | **Status:** Production Ready ✅
