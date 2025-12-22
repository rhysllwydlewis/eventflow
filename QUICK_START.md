# Quick Start Guide - Google Pay Subscriptions

## For Developers

### Local Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/rhysllwydlewis/eventflow.git
   cd eventflow
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection string and other settings
   ```

3. **Start Local Development**
   ```bash
   npm run dev
   ```

### Testing Subscription Flow

1. **Access Subscription Page**
   - Navigate to: `http://localhost:3000/supplier/subscription.html`
   - Must be logged in as a supplier

2. **View in Dashboard**
   - Go to: `http://localhost:3000/dashboard-supplier.html`
   - See subscription status card
   - Check package limit notice

3. **Test Google Pay** (requires configuration)
   - Update merchant ID in `public/supplier/js/googlepay-config.js`
   - Use Google Pay test cards
   - Monitor browser console for errors

### Key Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `functions/subscriptions.js` | Subscription business logic | Add features, change pricing |
| `public/supplier/js/subscription.js` | Frontend subscription UI | Change UI behavior |
| `public/supplier/css/subscription.css` | Subscription styles | Customize appearance |
| `public/supplier/js/googlepay-config.js` | Google Pay settings | Configure payment gateway |
| `firestore.rules` | Database security | Add/modify data access rules |

### Common Tasks

#### Add a New Subscription Plan

1. Edit `functions/subscriptions.js`:
   ```javascript
   const SUBSCRIPTION_PLANS = {
     // ... existing plans
     new_plan_id: {
       id: 'new_plan_id',
       name: 'Plan Name',
       tier: 'pro',
       price: 29.99,
       currency: 'GBP',
       billingCycle: 'monthly',
       trialDays: 14,
       features: [
         'Feature 1',
         'Feature 2',
       ],
     },
   };
   ```

2. Update frontend in `public/supplier/js/subscription.js`:
   ```javascript
   const PLANS = {
     // Add same plan definition
   };
   ```

3. Deploy and reinitialize plans

#### Change Badge Styles

Edit `public/assets/css/styles.css`:
```css
.supplier-badge.pro {
  background: linear-gradient(135deg, #your-color 0%, #your-color 100%);
  color: white;
}
```

#### Modify Feature Limits

Edit `public/supplier/js/feature-access.js`:
```javascript
const FEATURE_TIERS = {
  pro: {
    maxPackages: 100, // Change limit
    // ... other features
  },
};
```

#### Add Email Notifications

In `functions/subscriptions.js`, find TODO comments:
```javascript
// TODO: Send confirmation email
// Add your email service integration here
```

### Debugging

#### View Application Logs
```bash
# Check server logs
npm run dev
# Monitor MongoDB queries in the terminal
```

### Deployment

#### Deploy to Railway or Similar Platform
```bash
# Push code to GitHub
git push origin main

# Railway will auto-deploy from GitHub
# Configure environment variables in Railway dashboard
```

### Environment Variables

Set these in your hosting platform (Railway, Heroku, etc.):

```bash
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
SENDGRID_API_KEY=xxx  # If using SendGrid for emails
```

### Monitoring

#### Check Subscription Status
1. Connect to MongoDB Atlas
2. Navigate to `suppliers` collection
3. Check `subscription` field for any supplier

#### Check Payment Records
1. Navigate to `payments` collection
2. Filter by `status: "success"`

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Google Pay button not showing | Check browser console, verify Google Pay script loaded |
| Payment not processing | Check server logs, verify payment gateway configuration |
| Badge not displaying | Verify supplier has `subscription.tier` field |
| Package limit not enforced | Check `feature-access.js` imported in dashboard |

### Useful Commands

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Run tests
npm test

# Syntax check
node -c public/supplier/js/subscription.js
```

### Security Checklist

- [ ] Never commit `.env` files
- [ ] Keep merchant IDs in environment variables
- [ ] Don't expose sensitive error messages to clients
- [ ] Verify user authentication in Cloud Functions
- [ ] Use Firestore security rules for data access
- [ ] Sanitize all user inputs
- [ ] Use HTTPS only in production

### Resources

- 📚 [Full Deployment Guide](./GOOGLE_PAY_DEPLOYMENT.md)
- 📚 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- 🔧 [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- 💳 [Google Pay Integration](https://developers.google.com/pay/api/web)
- 🔥 [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Getting Help

1. Check the logs: `firebase functions:log`
2. Review documentation in this repo
3. Check Firebase Console for errors
4. Review Google Pay integration guide
5. Contact the development team

---

**Quick Links:**
- [Subscription Page](./public/supplier/subscription.html)
- [Cloud Functions](./functions/subscriptions.js)
- [Feature Access Control](./public/supplier/js/feature-access.js)
- [Firestore Rules](./firestore.rules)
