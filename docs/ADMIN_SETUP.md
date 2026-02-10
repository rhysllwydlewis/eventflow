# Admin Authentication Setup Guide

## Overview

EventFlow implements a gold-standard admin authentication system with two primary mechanisms:

1. **Protected Owner Account** - A single, protected admin account that cannot be deleted or demoted
2. **Domain-Based Admin Promotion** - Automatic admin role assignment for verified emails from trusted domains

This guide walks you through setting up and configuring the admin authentication system.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Owner Account Configuration](#owner-account-configuration)
- [Domain-Based Admin Configuration](#domain-based-admin-configuration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Quick Start

### Minimum Required Configuration

For a basic production deployment, you need:

```bash
# .env file
OWNER_EMAIL=admin@your-domain.com
OWNER_PASSWORD=your-strong-password-here
```

The owner account is automatically created when the server starts.

### Recommended Configuration

For full admin authentication features:

```bash
# .env file
OWNER_EMAIL=admin@your-domain.com
OWNER_PASSWORD=your-strong-password-here
ADMIN_DOMAINS=your-domain.com
```

This enables automatic admin promotion for all verified emails from `@your-domain.com`.

---

## Owner Account Configuration

### What is the Owner Account?

The owner account is a special, protected admin account with the following characteristics:

- ✅ **Automatically created** on server startup if it doesn't exist
- ✅ **Pre-verified** - no email verification required
- ✅ **Cannot be deleted** by any user, including other admins
- ✅ **Cannot be demoted** to a lower role
- ✅ **Cannot have email changed** through admin interface
- ✅ **Full admin privileges** - access to all admin features

### Environment Variables

#### OWNER_EMAIL (Required in Production)

The email address for the owner account.

```bash
OWNER_EMAIL=admin@event-flow.co.uk
```

**Default**: `admin@event-flow.co.uk`

**Recommendations**:

- Use your company/organization domain
- Use a shared email address (e.g., `admin@`, `ops@`)
- Avoid personal email addresses

#### OWNER_PASSWORD (Required in Production)

The password for the owner account.

```bash
OWNER_PASSWORD=YourStrongPasswordHere123!
```

**Default**: `Admin123!` (⚠️ INSECURE - only for development)

**Requirements**:

- Minimum 8 characters
- Must include uppercase, lowercase, numbers, and special characters
- Should be unique and not used elsewhere
- Store securely (use password manager)

**⚠️ Security Warning**: The server will warn on startup if you're using the default password in production:

```
⚠️  WARNING: Using default owner password in production!
   Set OWNER_PASSWORD environment variable to a strong password.
```

### Owner Account Features

#### Login

The owner can log in using their configured email and password:

```
Email: admin@your-domain.com
Password: (your configured password)
```

#### First-Time Setup

1. Set `OWNER_EMAIL` and `OWNER_PASSWORD` in your `.env` file
2. Start the server
3. The owner account is automatically created
4. Log in with the configured credentials

#### Updating Owner Account

**Password**: The owner can change their password through the user profile settings.

**Email**: Cannot be changed through the admin interface for security. To change:

1. Update `OWNER_EMAIL` in `.env`
2. Restart the server
3. The system will update the owner account flags

---

## Domain-Based Admin Configuration

### What is Domain-Based Admin Promotion?

Domain-based admin promotion automatically grants admin role to verified users from trusted email domains.

**How it works**:

1. User registers with email from trusted domain (e.g., `user@your-company.com`)
2. User verifies their email address
3. System automatically upgrades their role to admin
4. User gains full admin privileges

### Environment Variables

#### ADMIN_DOMAINS (Optional)

Comma-separated list of domains for automatic admin promotion.

```bash
# Single domain
ADMIN_DOMAINS=your-company.com

# Multiple domains
ADMIN_DOMAINS=your-company.com,partner-company.com,yourcompany.io
```

**Default**: Empty (domain-based promotion disabled)

**Format Rules**:

- ✅ Domain names only (no protocols)
- ✅ Lowercase recommended
- ✅ Multiple domains separated by commas
- ❌ No wildcards (e.g., `*.company.com`)
- ❌ No spaces
- ❌ No leading/trailing dots

**Valid Examples**:

```bash
ADMIN_DOMAINS=event-flow.co.uk
ADMIN_DOMAINS=example.com,example.org
ADMIN_DOMAINS=mycompany.com,partner.io,subsidiary.co
```

**Invalid Examples**:

```bash
ADMIN_DOMAINS=*.example.com         # ❌ No wildcards
ADMIN_DOMAINS=https://example.com   # ❌ No protocols
ADMIN_DOMAINS=.example.com          # ❌ No leading dots
ADMIN_DOMAINS=example.com, test.io  # ❌ No spaces (use commas only)
```

### Domain Validation on Startup

The server validates `ADMIN_DOMAINS` format on startup. If invalid, the server will exit with an error:

```
❌ CRITICAL: Invalid ADMIN_DOMAINS configuration
   Invalid ADMIN_DOMAINS: Wildcards not allowed (found: *.example.com)

Fix the ADMIN_DOMAINS environment variable and restart.
```

### User Flow with Domain-Based Admin

#### Registration Flow

```
1. User registers: john@yourcompany.com
   → Initial role: customer/supplier (as requested)
   → Email verification sent

2. User clicks verification link
   → Email verified
   → Role automatically upgraded to: admin
   → User gains admin access
```

#### Security Features

- ✅ **Email verification required** - no auto-promotion before verification
- ✅ **Domain exact match** - must match exactly (not subdomain)
- ✅ **Audit logging** - all role upgrades are logged
- ✅ **Works with owner account** - owner is always admin, regardless of domain

---

## Security Best Practices

### Password Security

1. **Use Strong Passwords**
   - Minimum 12 characters
   - Include uppercase, lowercase, numbers, symbols
   - Use a password manager

2. **Rotate Passwords Regularly**
   - Change owner password every 90 days
   - Update in `.env` and restart

3. **Don't Commit Passwords**
   - Never commit `.env` to version control
   - Use secrets management (GitHub Secrets, Vault, etc.)

### Domain Security

1. **Verify Domain Ownership**
   - Only add domains you control
   - Verify email configuration is secure

2. **Monitor Admin Access**
   - Regularly review admin user list
   - Check audit logs for suspicious activity

3. **Limit Admin Domains**
   - Only include necessary domains
   - Remove unused domains

### Production Checklist

Before deploying to production:

- [ ] Set strong `OWNER_PASSWORD` (not default)
- [ ] Configure `OWNER_EMAIL` for your organization
- [ ] Set `ADMIN_DOMAINS` only for trusted domains
- [ ] Verify domain format (no wildcards, protocols)
- [ ] Test owner login
- [ ] Test domain-based promotion (if configured)
- [ ] Review audit logs
- [ ] Document emergency access procedures

---

## Troubleshooting

### Server Won't Start - Invalid ADMIN_DOMAINS

**Error**:

```
❌ CRITICAL: Invalid ADMIN_DOMAINS configuration
```

**Solution**:

1. Check `ADMIN_DOMAINS` format in `.env`
2. Remove invalid characters (wildcards, protocols, spaces)
3. Ensure domains are comma-separated with no spaces
4. Restart server

### Owner Account Not Created

**Symptoms**:

- Can't log in with owner credentials
- No owner account visible in admin panel

**Solutions**:

1. Check `OWNER_EMAIL` is set in `.env`
2. Check server startup logs for seed errors
3. Verify database connection
4. Try restarting server

### Domain Admin Not Working

**Symptoms**:

- User registered with admin domain
- User verified email
- User still has customer/supplier role

**Solutions**:

1. Verify `ADMIN_DOMAINS` is set correctly
2. Check domain matches exactly (no subdomains)
3. Ensure user's email is verified
4. Check server logs for domain matching
5. Try logging out and back in

### Can't Delete/Modify Owner Account

**This is expected behavior!**

The owner account is protected by design. If you need to modify:

- **Password**: Owner can change through profile settings
- **Email**: Update `OWNER_EMAIL` in `.env` and restart
- **Delete**: Not possible (this is a security feature)

---

## Advanced Configuration

### Multiple Owners (Not Supported)

By design, there is only one owner account. For multiple high-privilege users:

1. Use domain-based admin promotion
2. Grant admin role manually through admin panel
3. Consider role-based access control (RBAC) permissions

### Custom Owner Email Format

You can use any valid email format:

```bash
# Corporate email
OWNER_EMAIL=admin@company.com

# Plus addressing
OWNER_EMAIL=admin+production@company.com

# Subdomain
OWNER_EMAIL=ops@platform.company.com
```

### Development vs. Production

**Development**:

```bash
OWNER_EMAIL=admin@event-flow.co.uk
OWNER_PASSWORD=Admin123!  # Default OK for dev
ADMIN_DOMAINS=event-flow.co.uk
```

**Production**:

```bash
OWNER_EMAIL=admin@your-company.com
OWNER_PASSWORD=3xtr3m3lyS3cur3P@ssw0rd!
ADMIN_DOMAINS=your-company.com
```

### Disabling Domain-Based Admin

To disable domain-based admin promotion:

```bash
# Option 1: Remove/comment out ADMIN_DOMAINS
# ADMIN_DOMAINS=

# Option 2: Set to empty string
ADMIN_DOMAINS=
```

### Emergency Access

If you lose access to the owner account:

1. **Password Reset**: Not available for owner (security)
2. **Emergency Solution**: Direct database access

   ```javascript
   // Connect to MongoDB
   db.users.updateOne(
     { email: 'admin@your-domain.com' },
     { $set: { passwordHash: bcrypt.hashSync('NewPassword123!', 10) } }
   );
   ```

3. **Prevention**: Document owner credentials securely

---

## Audit Logging

All admin authentication events are logged:

- Owner account creation
- Domain-based role upgrades
- Failed owner account modifications
- Admin role grants/revokes

View audit logs in the admin panel under **Settings** → **Audit Log**.

---

## Examples

### Example 1: Single Company

```bash
# .env
OWNER_EMAIL=admin@mycompany.com
OWNER_PASSWORD=MySecurePassword123!
ADMIN_DOMAINS=mycompany.com
```

Result: All verified `@mycompany.com` emails become admins.

### Example 2: Multi-Domain Organization

```bash
# .env
OWNER_EMAIL=admin@parent.com
OWNER_PASSWORD=SecurePass456!
ADMIN_DOMAINS=parent.com,subsidiary1.com,subsidiary2.com
```

Result: Verified emails from any of the three domains become admins.

### Example 3: Owner Only (No Domain Promotion)

```bash
# .env
OWNER_EMAIL=owner@event-flow.co.uk
OWNER_PASSWORD=OwnerSecurePass789!
# No ADMIN_DOMAINS set
```

Result: Only owner has admin access. Others must be manually promoted.

---

## Support

For issues or questions:

1. Check this documentation
2. Review server startup logs
3. Check audit logs in admin panel
4. Consult main README.md
5. Open an issue on GitHub

---

## Related Documentation

- [Security Model](./SECURITY.md) - Security architecture and threat model
- [README.md](../README.md) - General setup and deployment
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Production deployment

---

**Last Updated**: 2026-02-10  
**Version**: 18.1.0
