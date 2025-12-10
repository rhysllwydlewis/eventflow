/**
 * Audit Logging Middleware
 * Tracks admin actions for compliance and security
 */

'use strict';

const { write, read, uid } = require('../store');

/**
 * Log an admin action to the audit log
 * @param {Object} params - Audit log parameters
 * @param {string} params.adminId - ID of the admin user performing the action
 * @param {string} params.adminEmail - Email of the admin user
 * @param {string} params.action - Type of action performed
 * @param {string} params.targetType - Type of resource affected (user, supplier, review, etc.)
 * @param {string} params.targetId - ID of the affected resource
 * @param {Object} params.details - Additional details about the action
 * @param {string} params.ipAddress - IP address of the request
 * @param {string} params.userAgent - User agent string
 * @returns {Object} The created audit log entry
 */
function auditLog(params) {
  const {
    adminId,
    adminEmail,
    action,
    targetType,
    targetId,
    details = {},
    ipAddress = null,
    userAgent = null
  } = params;

  const now = new Date().toISOString();
  const logEntry = {
    id: uid('audit'),
    adminId,
    adminEmail,
    action,
    targetType,
    targetId,
    details,
    ipAddress,
    userAgent,
    timestamp: now,
    createdAt: now
  };

  const logs = read('audit_logs');
  logs.push(logEntry);
  write('audit_logs', logs);

  console.log(`[AUDIT] ${adminEmail} performed ${action} on ${targetType} ${targetId}`);
  
  return logEntry;
}

/**
 * Express middleware to automatically log admin actions
 * Usage: router.post('/api/admin/users/:id/ban', auditMiddleware('user_ban'), handler)
 * 
 * @param {string} action - The action being performed
 * @param {Function} getTargetInfo - Optional function to extract target type and ID from req
 * @returns {Function} Express middleware function
 */
function auditMiddleware(action, getTargetInfo = null) {
  return (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Only log if the response was successful (2xx status code)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let targetType = 'unknown';
          let targetId = 'unknown';
          
          // Extract target info from custom function or request params
          if (getTargetInfo) {
            const targetInfo = getTargetInfo(req, data);
            targetType = targetInfo.targetType;
            targetId = targetInfo.targetId;
          } else if (req.params.id) {
            targetId = req.params.id;
            // Try to infer type from URL
            if (req.path.includes('/users/')) targetType = 'user';
            else if (req.path.includes('/suppliers/')) targetType = 'supplier';
            else if (req.path.includes('/reviews/')) targetType = 'review';
            else if (req.path.includes('/reports/')) targetType = 'report';
          }
          
          auditLog({
            adminId: req.user.id,
            adminEmail: req.user.email,
            action,
            targetType,
            targetId,
            details: {
              body: req.body,
              query: req.query,
              params: req.params
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
          });
        } catch (err) {
          console.error('Error creating audit log:', err.message);
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Get audit logs with optional filtering
 * @param {Object} filters - Filter options
 * @param {string} filters.adminId - Filter by admin user ID
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.targetType - Filter by target type
 * @param {string} filters.targetId - Filter by target ID
 * @param {string} filters.startDate - Filter by start date (ISO string)
 * @param {string} filters.endDate - Filter by end date (ISO string)
 * @param {number} filters.limit - Maximum number of results
 * @returns {Array} Filtered audit log entries
 */
function getAuditLogs(filters = {}) {
  const {
    adminId,
    action,
    targetType,
    targetId,
    startDate,
    endDate,
    limit = 100
  } = filters;

  let logs = read('audit_logs');

  // Apply filters
  if (adminId) {
    logs = logs.filter(log => log.adminId === adminId);
  }
  if (action) {
    logs = logs.filter(log => log.action === action);
  }
  if (targetType) {
    logs = logs.filter(log => log.targetType === targetType);
  }
  if (targetId) {
    logs = logs.filter(log => log.targetId === targetId);
  }
  if (startDate) {
    logs = logs.filter(log => log.timestamp >= startDate);
  }
  if (endDate) {
    logs = logs.filter(log => log.timestamp <= endDate);
  }

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });

  // Apply limit
  return logs.slice(0, limit);
}

/**
 * Action types for consistent logging
 */
const AUDIT_ACTIONS = {
  // User management
  USER_CREATED: 'user_created',
  USER_SUSPENDED: 'user_suspended',
  USER_UNSUSPENDED: 'user_unsuspended',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned',
  USER_VERIFIED: 'user_verified',
  USER_PASSWORD_RESET: 'user_password_reset',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_DELETED: 'user_deleted',
  USER_EDITED: 'user_edited',
  
  // Supplier management
  SUPPLIER_APPROVED: 'supplier_approved',
  SUPPLIER_REJECTED: 'supplier_rejected',
  SUPPLIER_VERIFIED: 'supplier_verified',
  SUPPLIER_PRO_GRANTED: 'supplier_pro_granted',
  SUPPLIER_PRO_REVOKED: 'supplier_pro_revoked',
  SUPPLIER_DELETED: 'supplier_deleted',
  SUPPLIER_EDITED: 'supplier_edited',
  
  // Package management
  PACKAGE_APPROVED: 'package_approved',
  PACKAGE_REJECTED: 'package_rejected',
  PACKAGE_DELETED: 'package_deleted',
  PACKAGE_EDITED: 'package_edited',
  
  // Content moderation
  REVIEW_APPROVED: 'review_approved',
  REVIEW_REJECTED: 'review_rejected',
  REVIEW_DELETED: 'review_deleted',
  PHOTO_APPROVED: 'photo_approved',
  PHOTO_REJECTED: 'photo_rejected',
  
  // Report handling
  REPORT_RESOLVED: 'report_resolved',
  REPORT_DISMISSED: 'report_dismissed',
  
  // System actions
  DATA_EXPORT: 'data_export',
  SETTINGS_CHANGED: 'settings_changed'
};

module.exports = {
  auditLog,
  auditMiddleware,
  getAuditLogs,
  AUDIT_ACTIONS
};
