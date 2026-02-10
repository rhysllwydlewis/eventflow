/**
 * Domain-Based Admin Authentication Middleware
 * Automatically grants admin role to verified emails from trusted domains
 * 
 * Security considerations:
 * - Only activates AFTER email verification (prevents abuse)
 * - Uses environment variable ADMIN_DOMAINS for configuration
 * - Supports multiple domains (comma-separated)
 * - Owner email is always treated as admin (even if domain not in list)
 */

'use strict';

const logger = require('../utils/logger');

// Get owner email from environment or use default
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'admin@event-flow.co.uk';

// Parse admin domains from environment variable
function getAdminDomains() {
  const domainsStr = process.env.ADMIN_DOMAINS || '';
  if (!domainsStr.trim()) {
    return [];
  }
  
  // Split by comma, trim, and filter out empty strings
  const domains = domainsStr
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0);
  
  return domains;
}

/**
 * Validate ADMIN_DOMAINS format
 * Ensures no wildcards and proper domain format
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateAdminDomainsFormat() {
  const domainsStr = process.env.ADMIN_DOMAINS;
  
  // If not set, that's fine - no admin domains
  if (!domainsStr || !domainsStr.trim()) {
    return { valid: true };
  }
  
  const domains = getAdminDomains();
  
  for (const domain of domains) {
    // Check for wildcards (security risk)
    if (domain.includes('*')) {
      return {
        valid: false,
        error: `Invalid ADMIN_DOMAINS: Wildcards not allowed (found: ${domain})`,
      };
    }
    
    // Basic domain format validation
    // Must contain at least one dot and no spaces
    if (!domain.includes('.') || domain.includes(' ')) {
      return {
        valid: false,
        error: `Invalid ADMIN_DOMAINS: Invalid domain format (found: ${domain})`,
      };
    }
    
    // Check for common mistakes
    if (domain.startsWith('.') || domain.endsWith('.')) {
      return {
        valid: false,
        error: `Invalid ADMIN_DOMAINS: Domain cannot start or end with dot (found: ${domain})`,
      };
    }
    
    // Check for protocol in domain (common mistake)
    if (domain.includes('://')) {
      return {
        valid: false,
        error: `Invalid ADMIN_DOMAINS: Domain should not include protocol (found: ${domain})`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check if email domain is in admin domain list
 * @param {string} email - Email address to check
 * @returns {boolean} True if email domain is in admin domains
 */
function isAdminDomain(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailLower = email.toLowerCase().trim();
  const atIndex = emailLower.lastIndexOf('@');
  
  if (atIndex === -1 || atIndex === emailLower.length - 1) {
    return false; // Invalid email format
  }
  
  const domain = emailLower.substring(atIndex + 1);
  const adminDomains = getAdminDomains();
  
  return adminDomains.includes(domain);
}

/**
 * Check if email matches owner email
 * @param {string} email - Email address to check
 * @returns {boolean} True if email matches owner
 */
function isOwnerEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  return email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase();
}

/**
 * Determine the appropriate role for a user based on email and verification status
 * 
 * Business logic:
 * 1. If email is owner email → always admin, always verified
 * 2. If email domain is admin domain AND verified → admin
 * 3. Otherwise → use requested role
 * 
 * @param {string} email - User email address
 * @param {string} requestedRole - Role requested by user during registration
 * @param {boolean} isVerified - Whether email is verified
 * @returns {Object} { role: string, shouldUpgrade: boolean, reason?: string }
 */
function determineRole(email, requestedRole, isVerified) {
  // Owner email always gets admin role
  if (isOwnerEmail(email)) {
    return {
      role: 'admin',
      shouldUpgrade: true,
      reason: 'owner_email',
    };
  }
  
  // Admin domain emails get admin role ONLY after verification
  if (isAdminDomain(email)) {
    if (isVerified) {
      return {
        role: 'admin',
        shouldUpgrade: true,
        reason: 'admin_domain_verified',
      };
    } else {
      // Not yet verified - use requested role, but mark for future upgrade
      return {
        role: requestedRole || 'customer',
        shouldUpgrade: false,
        reason: 'admin_domain_pending_verification',
        willUpgradeOnVerification: true,
      };
    }
  }
  
  // Regular user - use requested role
  return {
    role: requestedRole || 'customer',
    shouldUpgrade: false,
    reason: 'regular_user',
  };
}

/**
 * Check if a user should be auto-upgraded to admin after email verification
 * This is called during the verification flow
 * 
 * @param {string} email - User email address
 * @returns {boolean} True if user should be upgraded to admin
 */
function shouldUpgradeToAdminOnVerification(email) {
  // Owner email is already admin, no upgrade needed
  if (isOwnerEmail(email)) {
    return false;
  }
  
  // Admin domain emails should be upgraded
  return isAdminDomain(email);
}

/**
 * Get owner email from environment
 * @returns {string} Owner email address
 */
function getOwnerEmail() {
  return OWNER_EMAIL;
}

/**
 * Get admin domains list
 * @returns {string[]} Array of admin domains
 */
function getAdminDomainsList() {
  return getAdminDomains();
}

/**
 * Log admin authentication configuration on startup
 */
function logAdminAuthConfig() {
  const ownerEmail = getOwnerEmail();
  const adminDomains = getAdminDomainsList();
  
  logger.info('Admin Authentication Configuration', {
    ownerEmail,
    adminDomainsCount: adminDomains.length,
    adminDomains: adminDomains.length > 0 ? adminDomains : 'none configured',
  });
  
  if (adminDomains.length > 0) {
    logger.info(
      `Domain-based admin promotion enabled for: ${adminDomains.join(', ')}`
    );
  } else {
    logger.info('Domain-based admin promotion: DISABLED (no ADMIN_DOMAINS configured)');
  }
}

module.exports = {
  isAdminDomain,
  isOwnerEmail,
  determineRole,
  shouldUpgradeToAdminOnVerification,
  validateAdminDomainsFormat,
  getOwnerEmail,
  getAdminDomainsList,
  logAdminAuthConfig,
};
