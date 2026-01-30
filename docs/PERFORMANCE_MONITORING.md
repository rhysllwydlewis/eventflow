# Performance Monitoring Guide

Comprehensive guide for monitoring and optimizing EventFlow's performance in production.

## Table of Contents

1. [Overview](#overview)
2. [Key Performance Indicators (KPIs)](#key-performance-indicators-kpis)
3. [Monitoring Tools & Setup](#monitoring-tools--setup)
4. [Performance Metrics](#performance-metrics)
5. [Alerting & Thresholds](#alerting--thresholds)
6. [Troubleshooting](#troubleshooting)
7. [Optimization Strategies](#optimization-strategies)

---

## Overview

EventFlow implements comprehensive performance monitoring across all layers of the application stack to ensure optimal user experience and system reliability.

### Monitoring Architecture

```
┌──────────────────────────────────────┐
│         User Browser                 │
│  - Real User Monitoring (RUM)        │
│  - Client-side errors                │
│  - Page load times                   │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│         Load Balancer/CDN            │
│  - Request distribution              │
│  - SSL termination                   │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│         Application Server           │
│  - Node.js metrics                   │
│  - API response times                │
│  - Error rates                       │
│  - Memory/CPU usage                  │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│         Database & Cache             │
│  - MongoDB performance               │
│  - Redis performance                 │
│  - Query execution times             │
└──────────────────────────────────────┘
```

---

## Key Performance Indicators (KPIs)

### Application KPIs

| Metric                           | Target | Warning | Critical |
| -------------------------------- | ------ | ------- | -------- |
| **API Response Time (P95)**      | <200ms | >500ms  | >1000ms  |
| **Page Load Time**               | <3s    | >5s     | >10s     |
| **Error Rate**                   | <0.1%  | >1%     | >5%      |
| **Uptime**                       | >99.9% | <99.5%  | <99%     |
| **Database Query Time (P95)**    | <100ms | >300ms  | >1000ms  |
| **WebSocket Connection Success** | >99%   | <95%    | <90%     |
| **Payment Success Rate**         | >98%   | <95%    | <90%     |
| **Email Delivery Rate**          | >98%   | <95%    | <90%     |

### Infrastructure KPIs

| Metric                   | Target | Warning | Critical |
| ------------------------ | ------ | ------- | -------- |
| **CPU Usage**            | <60%   | >80%    | >95%     |
| **Memory Usage**         | <70%   | >85%    | >95%     |
| **Disk I/O**             | <60%   | >80%    | >95%     |
| **Network Bandwidth**    | <70%   | >85%    | >95%     |
| **Database Connections** | <70%   | >85%    | >95%     |

### Business KPIs

| Metric                       | Target | Description           |
| ---------------------------- | ------ | --------------------- |
| **User Registration Rate**   | Track  | New users per day     |
| **Enquiry Conversion Rate**  | >5%    | Enquiries to bookings |
| **Lead Quality Score**       | >65    | Average lead score    |
| **Supplier Onboarding Time** | <24h   | Time to approval      |
| **Search Success Rate**      | >80%   | Searches with results |

---

## Monitoring Tools & Setup

### 1. Sentry (Error Tracking)

**Setup:**

```javascript
// server.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions

  // Performance monitoring
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    new Sentry.Integrations.Mongo(),
  ],

  // Custom tags
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      version: process.env.npm_package_version,
    };
    return event;
  },
});

// Error handler
app.use(Sentry.Handlers.errorHandler());
```

**Client-side Setup:**

```html
<!-- public/index.html -->
<script src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"></script>
<script>
  Sentry.init({
    dsn: 'YOUR_DSN_HERE',
    environment: 'production',
    release: 'eventflow@1.0.0',
    tracesSampleRate: 0.1,
  });
</script>
```

### 2. Winston Logging

**Configuration:**

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'eventflow' },
  transports: [
    // Write errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
```

### 3. Custom Metrics (Admin Dashboard)

**Implementation:**

```javascript
// services/metricsService.js
class MetricsService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      activeConnections: 0,
    };
  }

  recordRequest(duration) {
    this.metrics.requests++;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.requests - 1) + duration) /
      this.metrics.requests;
  }

  recordError() {
    this.metrics.errors++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.errors / this.metrics.requests,
      timestamp: new Date(),
    };
  }
}

// Middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsService.recordRequest(duration);

    if (res.statusCode >= 500) {
      metricsService.recordError();
    }

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        duration,
      });
    }
  });

  next();
});
```

### 4. Health Check Endpoints

**Implementation:**

```javascript
// routes/health.js
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'checking',
      redis: 'checking',
      email: 'checking',
    },
  };

  try {
    // Check database
    await db.admin().ping();
    health.checks.database = 'healthy';
  } catch (err) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis (if configured)
    if (redis) {
      await redis.ping();
      health.checks.redis = 'healthy';
    } else {
      health.checks.redis = 'not configured';
    }
  } catch (err) {
    health.checks.redis = 'unhealthy';
    health.status = 'degraded';
  }

  // Email service check
  health.checks.email = process.env.POSTMARK_API_KEY ? 'configured' : 'not configured';

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/health/detailed', requireAdmin, async (req, res) => {
  const detailed = {
    ...(await getBasicHealth()),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    connections: {
      database: db.db.serverConfig.connections().length,
      active: metricsService.metrics.activeConnections,
    },
    metrics: metricsService.getMetrics(),
  };

  res.json(detailed);
});
```

---

## Performance Metrics

### 1. API Response Times

**Track:**

- Average response time per endpoint
- P50, P95, P99 percentiles
- Slow requests (>1s)
- Error rates per endpoint

**Implementation:**

```javascript
// Middleware to track API metrics
const apiMetrics = new Map();

app.use((req, res, next) => {
  const start = Date.now();
  const route = `${req.method} ${req.route?.path || req.path}`;

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (!apiMetrics.has(route)) {
      apiMetrics.set(route, {
        count: 0,
        totalTime: 0,
        times: [],
      });
    }

    const metrics = apiMetrics.get(route);
    metrics.count++;
    metrics.totalTime += duration;
    metrics.times.push(duration);

    // Keep last 1000 requests for percentile calculation
    if (metrics.times.length > 1000) {
      metrics.times.shift();
    }
  });

  next();
});

// Endpoint to get metrics
app.get('/api/admin/metrics/api', requireAdmin, (req, res) => {
  const results = [];

  for (const [route, metrics] of apiMetrics.entries()) {
    const sorted = [...metrics.times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    results.push({
      route,
      count: metrics.count,
      avg: metrics.totalTime / metrics.count,
      p50,
      p95,
      p99,
    });
  }

  res.json(results.sort((a, b) => b.p95 - a.p95));
});
```

### 2. Database Performance

**Monitor:**

- Query execution times
- Connection pool usage
- Index usage
- Slow queries

**MongoDB Profiling:**

```javascript
// Enable profiling for slow queries (>100ms)
db.setProfilingLevel(1, { slowms: 100 });

// View slow queries
db.system.profile.find().limit(10).sort({ millis: -1 }).pretty();

// Analyze query performance
db.suppliers.find({ category: 'venue' }).explain('executionStats');
```

**Query Monitoring Middleware:**

```javascript
// Wrap database operations
const originalFind = db.collection.find;
db.collection.find = function (...args) {
  const start = Date.now();
  const result = originalFind.apply(this, args);

  result.toArray = async function () {
    const docs = await originalFind.prototype.toArray.apply(this, arguments);
    const duration = Date.now() - start;

    if (duration > 100) {
      logger.warn('Slow query', {
        collection: this.namespace.collection,
        duration,
        query: args[0],
      });
    }

    return docs;
  };

  return result;
};
```

### 3. Memory & CPU Usage

**Track:**

- Heap usage
- External memory
- RSS (Resident Set Size)
- CPU usage

**Implementation:**

```javascript
// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  if (heapUsedPercent > 90) {
    logger.error('High memory usage', {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      percent: heapUsedPercent,
    });

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Log metrics to monitoring service
  metricsService.recordMemory(usage);
}, 60000); // Every minute
```

### 4. WebSocket Performance

**Monitor:**

- Active connections
- Message throughput
- Connection errors
- Reconnection rate

**Implementation:**

```javascript
// WebSocket metrics
const wsMetrics = {
  connections: 0,
  messages: 0,
  errors: 0,
  reconnections: 0,
};

io.on('connection', socket => {
  wsMetrics.connections++;

  socket.on('disconnect', () => {
    wsMetrics.connections--;
  });

  socket.on('reconnect', () => {
    wsMetrics.reconnections++;
  });

  socket.on('error', () => {
    wsMetrics.errors++;
  });

  socket.use((packet, next) => {
    wsMetrics.messages++;
    next();
  });
});

// Expose metrics
app.get('/api/admin/metrics/websocket', requireAdmin, (req, res) => {
  res.json({
    ...wsMetrics,
    messagesPerSecond: wsMetrics.messages / process.uptime(),
  });
});
```

---

## Alerting & Thresholds

### Alert Configuration

```javascript
// services/alertingService.js
class AlertingService {
  constructor() {
    this.thresholds = {
      errorRate: 0.01, // 1%
      responseTime: 1000, // 1s
      memory: 0.9, // 90%
      cpu: 0.8, // 80%
    };

    this.alertCooldown = new Map();
  }

  async checkAndAlert(metric, value, threshold) {
    if (value > threshold) {
      const key = `${metric}:${threshold}`;
      const lastAlert = this.alertCooldown.get(key);
      const cooldown = 15 * 60 * 1000; // 15 minutes

      if (!lastAlert || Date.now() - lastAlert > cooldown) {
        await this.sendAlert({
          metric,
          value,
          threshold,
          severity: this.getSeverity(metric, value, threshold),
        });

        this.alertCooldown.set(key, Date.now());
      }
    }
  }

  async sendAlert(alert) {
    // Send to multiple channels
    await Promise.all([
      this.sendEmailAlert(alert),
      this.sendSlackAlert(alert),
      this.logAlert(alert),
    ]);
  }

  getSeverity(metric, value, threshold) {
    const ratio = value / threshold;
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }
}
```

### Alert Channels

1. **Email Alerts**
   - Critical errors
   - Downtime notifications
   - Daily/weekly reports

2. **Slack/Discord Notifications**
   - Real-time alerts
   - Deployment notifications
   - Performance degradation warnings

3. **SMS Alerts** (Critical only)
   - Total system failure
   - Database unavailable
   - Payment processing failures

---

## Troubleshooting

### Common Performance Issues

#### 1. High Response Times

**Diagnosis:**

```javascript
// Check slow endpoints
GET /api/admin/metrics/api?sort=p95

// Check database queries
db.system.profile.find().sort({ millis: -1 }).limit(10);

// Check memory usage
GET /api/health/detailed
```

**Solutions:**

- Add database indexes
- Implement caching
- Optimize queries
- Enable compression
- Use CDN for static assets

#### 2. Memory Leaks

**Diagnosis:**

```bash
# Take heap snapshot
node --inspect server.js
# Use Chrome DevTools Memory Profiler
```

**Solutions:**

- Remove event listeners
- Clear intervals/timeouts
- Close database connections
- Implement proper garbage collection
- Use WeakMaps for caches

#### 3. High CPU Usage

**Diagnosis:**

```javascript
// Profile CPU usage
const profiler = require('v8-profiler-next');
profiler.startProfiling('CPU profile');

// After some time
const profile = profiler.stopProfiling();
profile.export((error, result) => {
  fs.writeFileSync('profile.cpuprofile', result);
  profile.delete();
});
```

**Solutions:**

- Optimize algorithms
- Use worker threads for heavy tasks
- Implement job queues
- Cache expensive operations
- Reduce synchronous operations

---

## Optimization Strategies

### 1. Database Optimization

- Create appropriate indexes
- Use projection to limit fields
- Implement pagination
- Aggregate data at query time
- Use connection pooling

### 2. Application Optimization

- Enable gzip compression
- Implement request caching
- Use asynchronous operations
- Minimize middleware
- Optimize image sizes

### 3. Infrastructure Optimization

- Use CDN for static assets
- Implement load balancing
- Enable HTTP/2
- Use Redis for session storage
- Scale horizontally when needed

---

## Monitoring Checklist

**Daily:**

- [ ] Check error rates
- [ ] Review slow queries
- [ ] Monitor uptime
- [ ] Check alert notifications

**Weekly:**

- [ ] Review performance trends
- [ ] Analyze user behavior
- [ ] Check database growth
- [ ] Review cache hit rates

**Monthly:**

- [ ] Full performance audit
- [ ] Capacity planning review
- [ ] Update alert thresholds
- [ ] Review and optimize slow endpoints

---

**Last Updated:** January 2026  
**Version:** 1.0
