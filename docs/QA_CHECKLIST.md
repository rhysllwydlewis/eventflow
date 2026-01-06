# Manual QA Checklist for Performance Improvements

## Pre-Deployment Checks

### 1. Local Environment Verification

#### Start Server

```bash
cd eventflow  # or your repository directory
JWT_SECRET="test-secret-min-32-chars-for-qa" npm start
```

**Expected:** Server starts without errors

#### Test Health Endpoint

```bash
curl http://localhost:3000/api/health | jq '.'
```

**Verify:**

- [ ] `status`: "ok"
- [ ] `services.server`: "running"
- [ ] `services.mongodb` or `services.activeBackend` present

#### Test Performance Endpoint

```bash
curl -H "Accept-Encoding: br, gzip, deflate" http://localhost:3000/api/performance | jq '.'
```

**Verify:**

- [ ] `status`: "ok"
- [ ] `server.compression.enabled`: true
- [ ] `server.compression.brotliSupport`: true
- [ ] `server.compression.gzipSupport`: true
- [ ] `verification.compressionActive`: true
- [ ] `verification.cachingActive`: true

### 2. Compression Testing

#### Test Homepage Compression (Brotli)

```bash
curl -H "Accept-Encoding: br" -I http://localhost:3000/ | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: br` (if Brotli supported by compression middleware)

#### Test Homepage Compression (Gzip Fallback)

```bash
curl -H "Accept-Encoding: gzip" -I http://localhost:3000/ | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: gzip`

#### Test CSS Compression

```bash
curl -H "Accept-Encoding: br, gzip" -I http://localhost:3000/assets/css/styles.css | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: br` or `Content-Encoding: gzip`

#### Test JS Compression

```bash
curl -H "Accept-Encoding: br, gzip" -I http://localhost:3000/assets/js/app.js | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: br` or `Content-Encoding: gzip`

### 3. Cache Header Testing

#### Test HTML Caching

```bash
curl -I http://localhost:3000/ | grep -i "cache-control"
```

**Expected:** `Cache-Control: public, max-age=300, must-revalidate`

#### Test CSS Caching

```bash
curl -I http://localhost:3000/assets/css/styles.css | grep -i "cache-control"
```

**Expected:** `Cache-Control: public, max-age=604800, must-revalidate`

#### Test JS Caching

```bash
curl -I http://localhost:3000/assets/js/app.js | grep -i "cache-control"
```

**Expected:** `Cache-Control: public, max-age=604800, must-revalidate`

#### Test Favicon Caching

```bash
curl -I http://localhost:3000/favicon.svg | grep -i "cache-control"
```

**Expected:** `Cache-Control: public, max-age=604800, must-revalidate`

### 4. Browser Testing

#### Open in Chrome/Edge

1. Navigate to `http://localhost:3000`
2. Open DevTools → Network tab
3. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

**Verify:**

- [ ] Homepage loads without errors
- [ ] CSS files show `br` or `gzip` encoding
- [ ] JS files show `br` or `gzip` encoding
- [ ] Images load correctly
- [ ] No console errors

#### Check Response Headers

1. In Network tab, click on main document (`localhost`)
2. Go to Headers tab
3. Scroll to Response Headers

**Verify:**

- [ ] `Content-Encoding: br` or `Content-Encoding: gzip`
- [ ] `Cache-Control: public, max-age=300, must-revalidate`

#### Check Static Asset Headers

1. Click on `styles.css` in Network tab
2. Go to Headers tab

**Verify:**

- [ ] `Content-Encoding: br` or `Content-Encoding: gzip`
- [ ] `Cache-Control: public, max-age=604800, must-revalidate`

### 5. Lighthouse Audit

#### Run Lighthouse

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Performance" category
4. Click "Generate report"

**Expected Scores:**

- [ ] Performance: 80+ / 100 (local dev)
- [ ] Best Practices: 90+ / 100

**Check Opportunities:**

- [ ] "Enable text compression" should be ✅ passed
- [ ] "Serve static assets with an efficient cache policy" should show assets cached

### 6. Asset Optimization

#### Check Asset Sizes

```bash
du -sh public/assets/css/
du -sh public/assets/js/
ls -lh public/favicon.svg
```

**Verify:**

- [ ] CSS directory: ~292KB (acceptable)
- [ ] JS directory: ~1.2MB (acceptable for feature set)
- [ ] Favicon: 245 bytes (optimal)

#### Check for Unnecessary Assets

```bash
find public/assets -type f -size +500k
```

**Verify:**

- [ ] No unexpectedly large files (> 500KB)
- [ ] If large files found, determine if they can be optimized

### 7. MongoDB Verification (if configured)

#### Check MongoDB Connection

```bash
curl http://localhost:3000/api/health | jq '.services.mongodb, .services.activeBackend'
```

**If MongoDB configured:**

- [ ] `mongodb`: "connected"
- [ ] `activeBackend`: "mongodb"

**If MongoDB not configured:**

- [ ] `activeBackend`: "local"
- [ ] Application still works (fallback mode)

#### Test Database Operations

1. Register a new user via `/api/auth/register`
2. Check health endpoint for query metrics

**Verify:**

- [ ] User registration succeeds
- [ ] Query metrics show reasonable performance (< 100ms average)

### 8. Documentation Verification

#### Check New Files Exist

```bash
ls -la docs/mongodb-migration.md
ls -la docs/PERFORMANCE_TESTING.md
```

**Verify:**

- [ ] `docs/mongodb-migration.md` exists (~16KB)
- [ ] `docs/PERFORMANCE_TESTING.md` exists (~14KB)

#### Check README Updates

```bash
grep -A 10 "Performance Strategy" README.md
grep "mongodb-migration.md" README.md
grep "PERFORMANCE_TESTING.md" README.md
```

**Verify:**

- [ ] Performance section mentions Brotli
- [ ] Links to new documentation present
- [ ] Compression verification commands included

## Post-Deployment Checks (Production)

### 1. Production URL Testing

**Replace `yourdomain.com` with actual deployment URL:**

#### Test Compression

```bash
curl -H "Accept-Encoding: br, gzip" -I https://yourdomain.com/ | grep -i "content-encoding"
```

**Expected:** `Content-Encoding: br` (preferred) or `Content-Encoding: gzip`

#### Test Caching

```bash
curl -I https://yourdomain.com/ | grep -i "cache-control"
curl -I https://yourdomain.com/assets/css/styles.css | grep -i "cache-control"
```

**Verify caching headers match specification**

#### Test HTTPS

```bash
curl -I http://yourdomain.com/
```

**Expected:** 301/302 redirect to `https://yourdomain.com/`

#### Test Security Headers

```bash
curl -I https://yourdomain.com/ | grep -E "Strict-Transport-Security|X-Frame-Options|X-Content-Type"
```

**Verify:**

- [ ] `Strict-Transport-Security` present
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`

### 2. Performance Endpoint

```bash
curl https://yourdomain.com/api/performance | jq '.'
```

**Verify:**

- [ ] Returns valid JSON
- [ ] Shows Brotli/gzip configuration
- [ ] No errors

### 3. Health Check

```bash
curl https://yourdomain.com/api/health | jq '.'
```

**Verify:**

- [ ] `status`: "ok"
- [ ] `services.mongodb`: "connected" (if MongoDB configured)
- [ ] `services.activeBackend`: "mongodb" (production)

### 4. Browser Testing (Production)

#### Chrome DevTools

1. Open production URL
2. DevTools → Network tab
3. Hard refresh

**Verify:**

- [ ] No 404 errors
- [ ] Assets load with compression
- [ ] Reasonable load time (< 3 seconds)

#### Lighthouse Audit (Production)

1. Run Lighthouse on production URL
2. Generate Performance report

**Expected:**

- [ ] Performance: 85+ / 100 (production with real data)
- [ ] "Enable text compression": ✅ Passed
- [ ] "Efficient cache policy": ✅ Passed for static assets

### 5. MongoDB Verification (Production)

#### Check Active Backend

```bash
curl https://yourdomain.com/api/health | jq '.services.activeBackend'
```

**Expected:** `"mongodb"` (not "local")

#### Check Readiness

```bash
curl -w "\nHTTP Status: %{http_code}\n" https://yourdomain.com/api/ready
```

**Expected:** HTTP 200 (ready)

## Regression Testing

### Existing Functionality Should Still Work

#### Authentication

- [ ] User can register
- [ ] User can login
- [ ] User can logout
- [ ] Password reset works

#### Supplier Features

- [ ] Supplier can create profile
- [ ] Supplier can add packages
- [ ] Supplier can upload photos
- [ ] Photos are optimized/compressed

#### Customer Features

- [ ] Customer can browse suppliers
- [ ] Customer can view packages
- [ ] Customer can send messages
- [ ] Customer can create event plans

#### Admin Features

- [ ] Admin dashboard loads
- [ ] Admin can view users
- [ ] Admin can moderate content
- [ ] Admin can export data

## Common Issues & Solutions

### Issue: Compression Not Working

**Symptoms:**

- No `Content-Encoding` header
- Large transfer sizes

**Check:**

1. Client sends `Accept-Encoding` header
2. Response size > 1KB (threshold)
3. Content-Type is compressible
4. No `x-no-compression` header

**Solution:**

- Verify compression middleware is loaded
- Check browser supports compression
- Review server logs for errors

### Issue: Wrong Cache Headers

**Symptoms:**

- Incorrect `Cache-Control` values
- Assets not caching

**Check:**

1. File path matches caching rules
2. Middleware order in server.js
3. No overriding headers

**Solution:**

- Review static file middleware in server.js
- Clear browser cache and retest
- Check for CDN/proxy overrides

### Issue: MongoDB Not Connected

**Symptoms:**

- `activeBackend: "local"` in health endpoint
- Readiness probe returns 503

**Check:**

1. `MONGODB_URI` environment variable set
2. MongoDB Atlas network access configured
3. Correct credentials in connection string

**Solution:**

- Set `MONGODB_URI` in deployment environment
- Whitelist IP in MongoDB Atlas
- Verify connection string format
- Check MongoDB Atlas status

## Sign-Off

### Performed By: **\*\*\*\***\_**\*\*\*\***

### Date: **\*\*\*\***\_**\*\*\*\***

### Checklist Summary

- [ ] All local tests passed
- [ ] Compression verified (Brotli/gzip)
- [ ] Cache headers correct
- [ ] Performance endpoint works
- [ ] Documentation complete
- [ ] MongoDB integration confirmed
- [ ] No regressions detected
- [ ] Production deployment verified (if deployed)
- [ ] Browser testing passed
- [ ] Lighthouse audit > 85

### Notes:

---

---

---

### Approval: ☐ Approved ☐ Rejected ☐ Needs Work

### Signature: **\*\*\*\***\_**\*\*\*\***
