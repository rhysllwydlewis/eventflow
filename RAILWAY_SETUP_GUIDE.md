# Railway Environment Variables Configuration Guide

This guide explains exactly what you need to configure in Railway for your EventFlow deployment.

## 🚨 CRITICAL ACTIONS REQUIRED

### 1. Remove Duplicate Variables

**DELETE these if they exist twice:**

- `NODE_ENV` - Keep only ONE instance, set to `production`

### 2. Variables to UPDATE

**Change these from placeholder values to real ones:**

| Variable      | Current (WRONG)                | Should Be                       |
| ------------- | ------------------------------ | ------------------------------- |
| `BASE_URL`    | `https://your-app.railway.app` | `https://event-flow.co.uk`      |
| `MONGODB_URI` | (if localhost)                 | MongoDB Atlas connection string |

### 3. Variables to DELETE/IGNORE

**DELETE these - they're for local development only:**

- `MONGODB_LOCAL_URI` - This is completely ignored in production and will cause confusion

## 📋 COMPLETE RAILWAY VARIABLES CHECKLIST

### ✅ Required Variables (MUST have these)

```bash
# Security (REQUIRED)
JWT_SECRET=<generate with: openssl rand -base64 32>
OWNER_PASSWORD=<strong password for admin@event-flow.co.uk>

# Server Configuration (REQUIRED)
NODE_ENV=production
PORT=3000
BASE_URL=https://event-flow.co.uk

# Trust Proxy for Railway (RECOMMENDED)
# Enables proper IP detection for rate limiting behind Railway's proxy
# Automatically enabled on Railway, but can be set explicitly
TRUST_PROXY=true
```

**Note about TRUST_PROXY:** This setting is **automatically enabled** when Railway is detected (via `RAILWAY_ENVIRONMENT`), but you can set it explicitly to `true` for clarity. This is required for proper rate limiting and IP detection when running behind Railway's reverse proxy. It fixes `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` errors from `express-rate-limit`.

### 🔌 Database - Choose ONE Option (RECOMMENDED but Optional)

**⚠️ IMPORTANT:** While the app can run without a cloud database, it will use local JSON storage which is **non-persistent**. Data will be **lost on server restart or redeployment**. A cloud database is **strongly recommended** for production use with real user data.

**Option A: MongoDB Atlas (Recommended for Production)**

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/eventflow?retryWrites=true&w=majority
MONGODB_DB_NAME=eventflow
```

**Option B: Firebase Firestore**

```bash
FIREBASE_PROJECT_ID=eventflow-ffb12
# Optional: For better security, also set
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**Option C: No Database (Local Storage Mode)**

```bash
# Do not set MONGODB_URI or FIREBASE_PROJECT_ID
# App will run with local JSON storage (non-persistent)
# A warning will be displayed at startup
```

### 📧 Email Service - Choose ONE Option (OPTIONAL but Recommended)

**Note:** Email service is optional. If not configured, emails will be saved to /outbox folder and warnings will be logged, but the application will start successfully.

**Option A: AWS SES (Recommended for production)**

```bash
EMAIL_ENABLED=true
FROM_EMAIL=no-reply@event-flow.co.uk
AWS_SES_REGION=eu-west-2
AWS_SES_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

**Option B: SendGrid**

```bash
EMAIL_ENABLED=true
FROM_EMAIL=no-reply@event-flow.co.uk
SENDGRID_API_KEY=SG.your-api-key-here
```

**Option C: Custom SMTP (Gmail, etc.)**

```bash
EMAIL_ENABLED=true
FROM_EMAIL=no-reply@event-flow.co.uk
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-password>
```

### 🎨 Optional Variables (Not required, but recommended)

**Firebase Client (for real-time features)**

```bash
FIREBASE_API_KEY=AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc
FIREBASE_AUTH_DOMAIN=eventflow-ffb12.firebaseapp.com
FIREBASE_PROJECT_ID=eventflow-ffb12
FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=253829522456
FIREBASE_APP_ID=1:253829522456:web:3fae1bcec63932321bcf6d
STORAGE_TYPE=firebase
```

**Stripe (for subscriptions)**

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SUPPLIER_PRICE_ID=price_...
```

**OpenAI (for AI features)**

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-mini
```

## 🛠️ Step-by-Step Setup in Railway

### Step 1: Access Variables

1. Go to your Railway project
2. Click on your service (eventflow)
3. Click on "Variables" tab

### Step 2: Clean Up Issues

1. **Check for duplicates:**
   - Search for `NODE_ENV`
   - If it appears twice, delete one (keep `NODE_ENV=production`)

2. **Delete development variables:**
   - Look for `MONGODB_LOCAL_URI`
   - Click the trash icon to delete it
   - It's not needed and will only cause confusion

### Step 3: Update Critical Variables

**BASE_URL**

- Find: `BASE_URL`
- Change from: `https://your-app.railway.app`
- Change to: `https://event-flow.co.uk`
- Click "Update" or "Save"

**MONGODB_URI** (if using MongoDB)

- Find: `MONGODB_URI`
- If it contains `localhost` → Replace with MongoDB Atlas connection string
- Example: `mongodb+srv://username:password@cluster.mongodb.net/eventflow`
- Click "Update" or "Save"

### Step 4: Verify Email Configuration

Check that you have **at least one** of these:

- [ ] `AWS_SES_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- [ ] `SENDGRID_API_KEY`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

If **none** are set, add your email service credentials now.

### Step 5: Redeploy

After making changes:

1. Click "Deploy" or wait for auto-deploy
2. Watch the deployment logs carefully
3. Look for these indicators:

**✅ Good startup logs:**

```
============================================================
EventFlow v17.0.0 - Starting Server
============================================================

📋 Checking configuration...
   BASE_URL: https://event-flow.co.uk
   NODE_ENV: production
   PORT: 3000

🔌 Initializing database...
   ✅ Using MongoDB for data storage

📧 Checking email configuration...
   ✅ Email: AWS SES configured
   ✅ AWS SES connection verified

============================================================
✅ Server is ready!
============================================================
```

**❌ Bad startup logs (will exit with error):**

```
❌ Production error: No cloud database configured!
   Set FIREBASE_PROJECT_ID or MONGODB_URI for production deployment
```

OR

```
❌ Production error: MONGODB_URI cannot point to localhost
```

OR

```
❌ Production deployment requires email service
```

## 🔍 Verification

After deployment:

1. **Check health endpoint:**
   - Visit: `https://event-flow.co.uk/api/health`
   - Should return:

   ```json
   {
     "ok": true,
     "server": "online",
     "version": "v17.0.0",
     "database": "mongodb",
     "databaseStatus": "connected",
     "emailStatus": "connected"
   }
   ```

2. **Check Railway logs:**
   - Look for `✅ Server is ready!`
   - No ❌ error messages
   - No warnings about localhost

3. **Test the application:**
   - Visit `https://event-flow.co.uk`
   - Try logging in
   - Verify features work

## 🆘 Troubleshooting

### Issue: "No cloud database configured"

**Solution:** Add `MONGODB_URI` (pointing to MongoDB Atlas) OR `FIREBASE_PROJECT_ID`

### Issue: "MONGODB_URI cannot point to localhost"

**Solution:** Replace `MONGODB_URI` value with MongoDB Atlas connection string

### Issue: Email warnings in logs

**Note:** Email service is optional. The application will start successfully with warnings if email is not configured. To enable email:

1. Set `EMAIL_ENABLED=true`
2. Add AWS SES, SendGrid, or SMTP credentials
3. Set `FROM_EMAIL` to your sender address

Or to disable email warnings, set `EMAIL_ENABLED=false`

### Issue: Still getting 502 errors

**Check:**

1. Railway logs for exact error message
2. `/api/health` endpoint response
3. All required variables are set (JWT_SECRET, BASE_URL, database config)
4. No duplicate variables
5. MongoDB Atlas allows Railway IP addresses (set to allow all: `0.0.0.0/0`)

## 📞 Quick Reference

**Minimum required for production:**

- `JWT_SECRET` ✓ (REQUIRED)
- `NODE_ENV=production` ✓ (REQUIRED)
- `BASE_URL=https://event-flow.co.uk` ✓ (REQUIRED)
- `MONGODB_URI` (cloud) OR `FIREBASE_PROJECT_ID` ✓ (REQUIRED)

**Optional (recommended for full functionality):**

- `EMAIL_ENABLED=true` (optional, defaults to false)
- `FROM_EMAIL=no-reply@event-flow.co.uk` (optional if EMAIL_ENABLED=false)
- Email service credentials (SES/SendGrid/SMTP) (optional, warnings logged if missing)

**Variables to DELETE:**

- `MONGODB_LOCAL_URI` ✗
- Duplicate `NODE_ENV` entries ✗

**Variables to UPDATE:**

- `BASE_URL` from placeholder to `https://event-flow.co.uk` ↻
- `MONGODB_URI` from localhost to cloud ↻
