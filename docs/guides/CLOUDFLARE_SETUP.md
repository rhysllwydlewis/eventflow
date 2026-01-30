# Cloudflare CDN Setup Guide for EventFlow

This guide walks you through setting up Cloudflare CDN for the EventFlow platform to improve performance, security, and reliability.

## Overview

Cloudflare provides:
- **CDN (Content Delivery Network)** - Cache and serve static assets globally
- **DDoS Protection** - Protect against malicious traffic
- **SSL/TLS** - Free SSL certificates
- **Analytics** - Monitor traffic and performance
- **Page Rules** - Fine-tune caching behavior

## Prerequisites

- EventFlow deployed and running
- Domain name (e.g., event-flow.co.uk)
- Access to domain DNS settings

## Step 1: Sign Up and Add Site

1. Go to [cloudflare.com](https://cloudflare.com) and create a free account
2. Click "Add a Site" and enter your domain (e.g., event-flow.co.uk)
3. Select the Free plan (sufficient for most use cases)
4. Cloudflare will scan your existing DNS records

## Step 2: Update DNS Records

1. Review the DNS records Cloudflare found
2. Add any missing records:
   - **A Record**: Point to your server IP (e.g., Railway deployment)
   - **CNAME**: `www` pointing to your root domain
3. Ensure the **Proxy status** (orange cloud) is enabled for:
   - Root domain (@)
   - www subdomain
   - Any other public-facing subdomains

## Step 3: Update Nameservers

1. Copy the Cloudflare nameservers (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
2. Go to your domain registrar (e.g., GoDaddy, Namecheap)
3. Replace your current nameservers with Cloudflare's nameservers
4. Wait for DNS propagation (can take up to 24 hours, usually faster)

## Step 4: Configure SSL/TLS Settings

1. Go to **SSL/TLS** > **Overview**
2. Set encryption mode:
   - If your origin server has SSL: **Full (strict)**
   - If no origin SSL: **Flexible** (but upgrade to Full ASAP)
3. Enable **Always Use HTTPS** under **SSL/TLS** > **Edge Certificates**
4. Enable **Automatic HTTPS Rewrites**
5. Set **Minimum TLS Version** to 1.2 or higher

## Step 5: Configure Caching Rules

### Page Rules (Free Plan: 3 rules)

Create the following page rules in order (priority matters):

#### Rule 1: Cache Static Assets Aggressively
- **URL Pattern**: `*event-flow.co.uk/assets/*`
- **Settings**:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month

#### Rule 2: Bypass Cache for API Endpoints
- **URL Pattern**: `*event-flow.co.uk/api/*`
- **Settings**:
  - Cache Level: Bypass

#### Rule 3: Cache HTML Pages with Short TTL
- **URL Pattern**: `*event-flow.co.uk/*.html`
- **Settings**:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 2 hours
  - Browser Cache TTL: 30 minutes

### Caching Configuration (Settings > Caching)

1. **Caching Level**: Standard
2. **Browser Cache TTL**: Respect Existing Headers
3. **Always Online**: Enabled (serves cached version if origin is down)

## Step 6: Performance Optimizations

### Speed Settings (Speed > Optimization)

Enable the following:

1. **Auto Minify**:
   - ✅ JavaScript
   - ✅ CSS
   - ✅ HTML

2. **Brotli**: Enabled (better compression than gzip)

3. **Early Hints**: Enabled (preload critical resources)

4. **HTTP/2**: Enabled (should be on by default)

5. **HTTP/3 (with QUIC)**: Enabled (for modern browsers)

### Rocket Loader

- **Recommendation**: Test with enabled, but disable if JavaScript issues occur
- Defers loading of JavaScript until after page load

## Step 7: Security Settings

### Security Level (Security > Settings)
- Set to **Medium** (adjust based on your needs)

### Bot Fight Mode
- Enable to block bad bots (free plan feature)

### Browser Integrity Check
- Enable to challenge browsers without valid User-Agent

### Challenge Passage
- Set to **30 minutes** or **1 hour**

## Step 8: Configure Firewall Rules (Optional)

On paid plans, create rules like:

```
# Block access from specific countries (if applicable)
(ip.geoip.country in {"CN" "RU"}) and (http.request.uri.path contains "/api/admin")

# Rate limit login attempts
(http.request.uri.path eq "/api/auth/login") and (rate.requests.5m > 10)
```

## Step 9: Update EventFlow Configuration

### Trust Cloudflare IPs

Update your Express.js configuration to trust Cloudflare proxies:

```javascript
// In server.js
app.set('trust proxy', true);
```

This ensures `req.ip` reflects the actual visitor IP, not Cloudflare's IP.

### Verify Real IP in Logs

Use Cloudflare headers to get real visitor IPs:
- `CF-Connecting-IP`: The actual visitor IP
- `CF-IPCountry`: Visitor's country code
- `CF-Ray`: Unique request identifier for debugging

## Step 10: Testing and Verification

### Verify CDN is Working

1. Check response headers using browser DevTools (Network tab):
   - Look for `CF-Cache-Status: HIT` (successful cache hit)
   - `CF-Ray`: Present on all responses through Cloudflare

2. Test from multiple locations:
   - Use tools like [GTmetrix](https://gtmetrix.com) or [WebPageTest](https://www.webpagetest.org)
   - Verify faster load times

### Clear Cache When Needed

To purge cache after deployments:
1. Go to **Caching** > **Configuration**
2. Click **Purge Everything** (use sparingly)
3. Or selectively purge by URL or tag

## Recommended Cache Headers in EventFlow

Add these to your Express.js responses:

```javascript
// Static assets (CSS, JS, images)
res.set('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days

// API responses (don't cache)
res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

// HTML pages
res.set('Cache-Control', 'public, max-age=7200, must-revalidate'); // 2 hours
```

## Advanced: Cache Everything with Bypass

For Pro plan users, use **Cache Rules** instead of Page Rules:

1. **Rule**: Cache static assets
   - Expression: `(http.request.uri.path matches "^/assets/.*")`
   - Action: Cache Everything, TTL: 1 month

2. **Rule**: Don't cache authenticated requests
   - Expression: `(http.cookie contains "token")`
   - Action: Bypass Cache

## Monitoring and Analytics

### Cloudflare Analytics

- View traffic, requests, and bandwidth usage
- Monitor cache hit ratio (aim for >80% for static assets)
- Track security threats blocked

### Set Up Alerts (Pro plan)

Configure alerts for:
- Traffic spikes
- High error rates (5xx)
- SSL certificate expiration

## Troubleshooting

### Issue: Stale Content After Deployment

**Solution**: Purge cache after each deployment
- Add to deployment script: 
  ```bash
  curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'
  ```

### Issue: Admin Panel Not Accessible

**Solution**: Ensure `/api/admin/*` is not cached
- Verify Page Rule or Cache Rule bypasses cache for admin endpoints
- Check that authentication cookies are working

### Issue: Slow TTFB (Time to First Byte)

**Solution**: 
- Reduce cache TTL to force more frequent origin checks
- Use Cloudflare Workers to cache dynamic content
- Enable Argo Smart Routing (paid feature)

## Cost Optimization

### Free Plan Limits
- Unlimited bandwidth
- 3 Page Rules
- Basic DDoS protection
- Shared SSL certificate

### When to Upgrade to Pro ($20/month)
- Need more Page Rules (20 rules)
- Want Argo Smart Routing
- Need Image Optimization
- Want Mobile Optimization

## Best Practices

1. **Always test** configuration changes in a staging environment first
2. **Monitor cache hit ratio** - aim for >80% for static assets
3. **Purge cache selectively** rather than purging everything
4. **Use versioned asset URLs** (e.g., `/assets/v2/app.js`) to avoid cache issues
5. **Enable "Development Mode"** when actively developing (bypasses cache for 3 hours)

## Additional Resources

- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cache Best Practices](https://developers.cloudflare.com/cache/best-practices/)
- [Security Best Practices](https://developers.cloudflare.com/fundamentals/basic-tasks/protect-your-origin-server/)

## Support

For EventFlow-specific Cloudflare issues:
- Check the EventFlow [GitHub Issues](https://github.com/rhysllwydlewis/eventflow/issues)
- Contact the EventFlow team

For Cloudflare-specific issues:
- Free plan: Community forums
- Paid plans: Email and chat support
