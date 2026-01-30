# Search & Cache Guide

Comprehensive guide for EventFlow's search functionality and caching strategy.

## Table of Contents

1. [Search Implementation](#search-implementation)
2. [Caching Strategy](#caching-strategy)
3. [Performance Optimization](#performance-optimization)
4. [Troubleshooting](#troubleshooting)

---

## Search Implementation

### Overview

EventFlow uses MongoDB text search combined with custom scoring algorithms to provide relevant search results for suppliers, packages, and content.

### Search Architecture

```
┌─────────────────┐
│  User Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Search Service (v2)    │
│  - Query parsing        │
│  - Text search          │
│  - Filtering            │
│  - Relevance scoring    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  MongoDB Text Indexes   │
│  - suppliers           │
│  - packages            │
│  - content             │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Results Processing     │
│  - Lead scoring         │
│  - Proximity scoring    │
│  - Relevance boost      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Cached Results         │
│  (Redis/In-Memory)      │
└─────────────────────────┘
```

### Search Features

#### 1. Full-Text Search

**Implementation:** `services/searchService.js`

```javascript
// Text search across multiple fields
const results = await searchService.searchSuppliers({
  query: 'wedding venue London',
  filters: {
    category: 'venue',
    priceRange: [1000, 5000],
    location: 'London',
  },
  sort: 'relevance',
  page: 1,
  limit: 20,
});
```

**Indexed Fields:**

- `businessName` (weight: 10)
- `description` (weight: 5)
- `tags` (weight: 8)
- `location` (weight: 3)
- `services` (weight: 6)

#### 2. Faceted Search

**Categories:**

- Venues
- Catering
- Photography
- Entertainment
- Decorations
- Other

**Filters:**

- Price range
- Location (postcode-based proximity)
- Rating
- Availability
- Event type compatibility

#### 3. Geo-Spatial Search

**Proximity Search:**

```javascript
// Find suppliers near location
const nearbySuppliers = await searchService.findNearby({
  postcode: 'SW1A 1AA',
  radiusMiles: 25,
  category: 'venue',
});
```

**Implementation:**

- UK postcode validation
- Haversine formula for distance calculation
- Configurable search radius
- Results sorted by distance

#### 4. Auto-Complete Suggestions

**Endpoint:** `GET /api/search/suggestions`

**Features:**

- Real-time suggestions as user types
- Debounced to reduce server load (300ms)
- Cached popular queries
- Typo tolerance using fuzzy matching

```javascript
// Client-side implementation
const suggestions = await fetch('/api/search/suggestions?q=weddi');
// Returns: ['wedding venue', 'wedding catering', 'wedding photography']
```

### Search Scoring

#### Relevance Score Calculation

```javascript
function calculateRelevance(result, query) {
  let score = result.textScore || 0; // MongoDB text score

  // Business name exact match: +50
  if (result.businessName.toLowerCase() === query.toLowerCase()) {
    score += 50;
  }

  // Business name starts with query: +30
  if (result.businessName.toLowerCase().startsWith(query.toLowerCase())) {
    score += 30;
  }

  // High rating boost: +20
  if (result.rating >= 4.5) {
    score += 20;
  }

  // Premium/Pro supplier: +15
  if (result.subscriptionTier === 'pro') {
    score += 15;
  }

  // Recent reviews: +10
  if (result.lastReviewDate > Date.now() - 90 * 24 * 60 * 60 * 1000) {
    score += 10;
  }

  // Proximity bonus (within 10 miles): +25
  if (result.distance && result.distance < 10) {
    score += 25;
  }

  return score;
}
```

### MongoDB Text Indexes

**Creating Indexes:**

```javascript
// Suppliers collection
db.suppliers.createIndex(
  {
    businessName: 'text',
    description: 'text',
    tags: 'text',
    location: 'text',
  },
  {
    weights: {
      businessName: 10,
      tags: 8,
      description: 5,
      location: 3,
    },
    name: 'supplier_text_search',
  }
);

// Geo-spatial index for proximity
db.suppliers.createIndex({ location: '2dsphere' });
```

**Verify Indexes:**

```bash
# In MongoDB shell
db.suppliers.getIndexes();
```

### Search API Endpoints

#### 1. General Search

```
GET /api/search
Query Parameters:
  - q: search query
  - category: filter by category
  - priceMin: minimum price
  - priceMax: maximum price
  - location: location filter
  - radius: search radius in miles
  - rating: minimum rating
  - page: page number
  - limit: results per page
  - sort: sort order (relevance, rating, price)
```

#### 2. Supplier Search

```
GET /api/search/suppliers
Query Parameters:
  - q: search query
  - category: supplier category
  - location: postcode or location
  - radius: search radius (default: 25 miles)
  - page: page number
  - limit: results per page
```

#### 3. Package Search

```
GET /api/search/packages
Query Parameters:
  - q: search query
  - eventType: wedding, corporate, etc.
  - budget: budget range
  - guests: number of guests
  - date: event date
```

---

## Caching Strategy

### Cache Layers

#### 1. Application Cache (In-Memory)

**Implementation:** `cache.js`

```javascript
const NodeCache = require('node-cache');
const appCache = new NodeCache({
  stdTTL: 600, // 10 minutes default
  checkperiod: 120, // Check for expired keys every 2 minutes
});

// Cache search results
appCache.set(`search:${queryHash}`, results, 600);

// Get cached results
const cached = appCache.get(`search:${queryHash}`);
```

**Cached Data:**

- Search results (10 minutes)
- Supplier listings (5 minutes)
- Category aggregations (15 minutes)
- Popular searches (30 minutes)
- Static content (1 hour)

#### 2. Redis Cache (Optional, for Clustering)

**Configuration:**

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Cache with expiry
await redis.setex(`search:${query}`, 600, JSON.stringify(results));

// Retrieve
const cached = await redis.get(`search:${query}`);
```

**Use Cases:**

- Multi-server deployments
- WebSocket session storage
- Rate limiting counters
- Distributed locks
- Job queues

#### 3. CDN Cache (Cloudinary)

**Static Assets:**

- Supplier logos
- Package images
- Profile photos
- Gallery images

**Configuration:**

- Automatic optimization
- Responsive images
- Lazy loading
- Browser caching (1 year)

#### 4. Browser Cache

**Headers Configuration:**

```javascript
// Static assets: 1 year
app.use(
  '/assets',
  express.static('public/assets', {
    maxAge: '1y',
    etag: true,
    lastModified: true,
  })
);

// HTML: no cache (always fresh)
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
```

### Cache Invalidation

#### Automatic Invalidation

```javascript
// Invalidate on data updates
async function updateSupplier(id, data) {
  await db.suppliers.updateOne({ _id: id }, { $set: data });

  // Invalidate related caches
  appCache.del(`supplier:${id}`);
  appCache.del('suppliers:list');
  appCache.flushStats();

  // Invalidate search cache
  const searchKeys = appCache.keys().filter(k => k.startsWith('search:'));
  searchKeys.forEach(key => appCache.del(key));
}
```

#### Manual Invalidation

**Admin Panel:**

- Clear all caches button
- Clear specific cache types
- View cache statistics
- Monitor cache hit rates

**API Endpoint:**

```
POST /api/admin/cache/clear
Body: {
  "type": "search" | "suppliers" | "all"
}
```

### Cache Warming

**Scheduled Tasks:**

```javascript
// Warm cache with popular searches
cron.schedule('0 * * * *', async () => {
  // Every hour
  const popularQueries = [
    'wedding venues London',
    'corporate catering',
    'birthday party entertainment',
  ];

  for (const query of popularQueries) {
    await searchService.search(query);
  }
});
```

### Cache Monitoring

**Metrics to Track:**

- Cache hit rate
- Cache miss rate
- Average response time (cached vs uncached)
- Cache size
- Eviction rate
- Memory usage

**Monitoring Tools:**

- Built-in `cache.getStats()`
- Redis INFO command
- APM tools (New Relic, Datadog)
- Custom metrics in admin dashboard

---

## Performance Optimization

### Search Optimization

#### 1. Query Optimization

```javascript
// Bad: Full collection scan
const results = await db.suppliers.find({
  businessName: new RegExp(query, 'i'),
});

// Good: Use text index
const results = await db.suppliers
  .find(
    {
      $text: { $search: query },
    },
    {
      score: { $meta: 'textScore' },
    }
  )
  .sort({ score: { $meta: 'textScore' } });
```

#### 2. Pagination

```javascript
// Always paginate large result sets
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

const results = await db.suppliers.find(query).skip(skip).limit(limit);
```

#### 3. Field Projection

```javascript
// Only return needed fields
const results = await db.suppliers.find(query, {
  businessName: 1,
  category: 1,
  rating: 1,
  priceRange: 1,
  logo: 1,
  // Exclude heavy fields like full description
  description: 0,
  fullDetails: 0,
});
```

### Cache Optimization

#### 1. Cache Keys

```javascript
// Use consistent, meaningful cache keys
const cacheKey = `search:${category}:${query}:${page}:${JSON.stringify(filters)}`;

// Hash long keys
const crypto = require('crypto');
const keyHash = crypto.createHash('md5').update(cacheKey).digest('hex');
```

#### 2. Cache Expiry Strategy

```javascript
// Different TTLs for different data
const TTL = {
  search: 10 * 60, // 10 minutes
  supplier: 5 * 60, // 5 minutes
  static: 60 * 60, // 1 hour
  config: 24 * 60 * 60, // 24 hours
};
```

#### 3. Stale-While-Revalidate

```javascript
async function getCachedWithRevalidate(key, fetchFn, ttl) {
  const cached = appCache.get(key);

  if (cached) {
    // Return cached immediately
    // Revalidate in background
    if (cached.age > ttl * 0.8) {
      // 80% of TTL
      fetchFn().then(fresh => appCache.set(key, fresh, ttl));
    }
    return cached.data;
  }

  // Cache miss: fetch and cache
  const fresh = await fetchFn();
  appCache.set(key, { data: fresh, age: 0 }, ttl);
  return fresh;
}
```

### Database Optimization

#### 1. Compound Indexes

```javascript
// Frequently used filter combinations
db.suppliers.createIndex({
  category: 1,
  rating: -1,
  priceRange: 1,
});
```

#### 2. Query Planning

```bash
# Explain query execution
db.suppliers.find({ category: 'venue' }).explain('executionStats');
```

#### 3. Connection Pooling

```javascript
// Configure connection pool
const client = new MongoClient(uri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
});
```

---

## Troubleshooting

### Common Issues

#### 1. Slow Search Queries

**Symptoms:**

- Search takes >1 second
- High database CPU usage
- Timeouts

**Solutions:**

```bash
# Check indexes
db.suppliers.getIndexes();

# Analyze slow queries
db.setProfilingLevel(2);
db.system.profile.find().limit(10).sort({ millis: -1 });

# Rebuild indexes
db.suppliers.reIndex();
```

#### 2. Cache Misses

**Symptoms:**

- Low cache hit rate (<70%)
- High database load
- Slow response times

**Solutions:**

```javascript
// Check cache stats
const stats = appCache.getStats();
console.log('Hit rate:', stats.hits / (stats.hits + stats.misses));

// Increase TTL for stable data
// Pre-warm cache for popular queries
// Optimize cache key strategy
```

#### 3. Memory Issues

**Symptoms:**

- High memory usage
- Cache evictions
- Out of memory errors

**Solutions:**

```javascript
// Set max cache size
const cache = new NodeCache({
  maxKeys: 1000,
  stdTTL: 600,
});

// Monitor memory
console.log(process.memoryUsage());

// Implement LRU eviction
```

#### 4. Stale Search Results

**Symptoms:**

- Outdated results shown
- New suppliers not appearing
- Updated data not reflected

**Solutions:**

```javascript
// Reduce cache TTL
// Implement cache invalidation on updates
// Use cache tagging for selective invalidation
```

### Monitoring & Debugging

#### Enable Debug Logging

```javascript
// Search debug logs
process.env.DEBUG = 'search:*';

// Cache debug logs
process.env.DEBUG = 'cache:*';
```

#### Performance Profiling

```javascript
// Add timing logs
console.time('search-query');
const results = await searchService.search(query);
console.timeEnd('search-query');
```

#### Cache Analytics

```javascript
// Admin endpoint for cache stats
app.get('/api/admin/cache/stats', (req, res) => {
  const stats = appCache.getStats();
  res.json({
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses),
    keys: appCache.keys().length,
    size: appCache.getStats().ksize,
  });
});
```

---

## Best Practices

### Search

1. **Always use indexes** for search queries
2. **Implement pagination** for all search results
3. **Cache frequently searched terms**
4. **Provide search suggestions** for better UX
5. **Track search analytics** to improve relevance

### Caching

1. **Cache at multiple levels** (browser, CDN, app, database)
2. **Set appropriate TTLs** based on data volatility
3. **Implement cache warming** for critical data
4. **Monitor cache hit rates** and adjust strategy
5. **Invalidate caches** on data updates
6. **Use Redis for distributed caching** in multi-server setups

### Performance

1. **Optimize database queries** before caching
2. **Use field projection** to reduce payload size
3. **Implement pagination** to limit result sets
4. **Compress responses** for API endpoints
5. **Monitor and alert** on performance degradation

---

## Additional Resources

- [MongoDB Text Search Documentation](https://docs.mongodb.com/manual/text-search/)
- [Redis Caching Patterns](https://redis.io/topics/lru-cache)
- [Node-Cache Documentation](https://www.npmjs.com/package/node-cache)
- [Cloudinary Optimization Guide](https://cloudinary.com/documentation/image_optimization)

---

**Last Updated:** January 2026  
**Version:** 1.0
