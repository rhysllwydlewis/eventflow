const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

function configureSecurityHeaders(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://js.stripe.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'https://api.stripe.com'],
          reportUri: '/api/csp-report',
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
    })
  );

  app.use(mongoSanitize());
}

function configureRateLimiting(app) {
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  app.use('/api/', apiLimiter);

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

module.exports = { configureSecurityHeaders, configureRateLimiting };
