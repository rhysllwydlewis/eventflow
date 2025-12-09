# 📸 EventFlow - Comprehensive Event Services Marketplace

A production-ready, feature-rich platform connecting event service suppliers (photographers, venues, caterers, entertainment, etc.) with customers planning events. Built with Node.js, Express, MongoDB, and modern web technologies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green)](https://www.mongodb.com/)

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

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB 6.0+ (local or Atlas)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/eventflow.git
cd eventflow

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
npm run migrate

# Start server
npm start
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

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[MongoDB Setup](MONGODB_SETUP.md)** - Database configuration guide
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

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete reference.

## 🔧 Environment Variables

**Required:**
```env
JWT_SECRET=your-secret-key-min-32-chars
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/eventflow
NODE_ENV=production
BASE_URL=https://yourdomain.com
```

**Email (Required for production):**
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

See [.env.example](.env.example) for all options.

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

### Railway
```bash
railway login
railway init
railway variables set JWT_SECRET="..." MONGODB_URI="..."
railway up
```

### Heroku
```bash
heroku create eventflow-app
heroku config:set JWT_SECRET="..." MONGODB_URI="..."
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

---

**Version:** v16.3.9 | **Status:** Production Ready ✅
