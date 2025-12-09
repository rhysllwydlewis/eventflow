/**
 * Content Reporting Routes
 * Handles user reports of inappropriate content, spam, and violations
 */

'use strict';

const express = require('express');
const { read, write, uid } = require('../store');
const { authRequired, roleRequired } = require('../middleware/auth');
const { auditLog, AUDIT_ACTIONS } = require('../middleware/audit');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for report submissions (prevent spam)
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 reports per 15 minutes
  message: 'Too many reports submitted. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/reports
 * Create a new report
 * Body: { type, targetId, reason, details }
 */
router.post('/', authRequired, reportLimiter, (req, res) => {
  const { type, targetId, reason, details } = req.body;
  
  // Validate input
  if (!type || !targetId || !reason) {
    return res.status(400).json({ 
      error: 'Missing required fields: type, targetId, reason' 
    });
  }
  
  const validTypes = ['supplier', 'review', 'message', 'user', 'photo'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ 
      error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` 
    });
  }
  
  const validReasons = [
    'spam',
    'inappropriate_content',
    'harassment',
    'false_information',
    'copyright_violation',
    'other'
  ];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ 
      error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` 
    });
  }
  
  // Check if target exists
  let targetExists = false;
  let targetData = null;
  
  switch (type) {
    case 'supplier':
      targetData = read('suppliers').find(s => s.id === targetId);
      targetExists = !!targetData;
      break;
    case 'review':
      targetData = read('reviews').find(r => r.id === targetId);
      targetExists = !!targetData;
      break;
    case 'message':
      targetData = read('messages').find(m => m.id === targetId);
      targetExists = !!targetData;
      break;
    case 'user':
      targetData = read('users').find(u => u.id === targetId);
      targetExists = !!targetData;
      break;
    case 'photo':
      // Photos are embedded in suppliers, need to check differently
      const suppliers = read('suppliers');
      for (const supplier of suppliers) {
        if (supplier.photos && supplier.photos.some(p => p.id === targetId)) {
          targetExists = true;
          targetData = { supplierId: supplier.id };
          break;
        }
      }
      break;
  }
  
  if (!targetExists) {
    return res.status(404).json({ 
      error: `${type} with ID ${targetId} not found` 
    });
  }
  
  // Check for duplicate reports (same user reporting same target)
  const existingReports = read('reports');
  const duplicateReport = existingReports.find(
    r => r.reportedBy === req.user.id && 
         r.targetId === targetId && 
         r.status === 'pending'
  );
  
  if (duplicateReport) {
    return res.status(400).json({ 
      error: 'You have already reported this content' 
    });
  }
  
  // Create report
  const now = new Date().toISOString();
  const report = {
    id: uid('report'),
    type,
    targetId,
    targetData, // Store snapshot of target for reference
    reason,
    details: details || '',
    reportedBy: req.user.id,
    reporterEmail: req.user.email,
    status: 'pending', // pending, reviewing, resolved, dismissed
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: now,
    updatedAt: now
  };
  
  existingReports.push(report);
  write('reports', existingReports);
  
  console.log(`New report created: ${type} ${targetId} by ${req.user.email}`);
  
  res.status(201).json({ 
    message: 'Report submitted successfully', 
    report: {
      id: report.id,
      type: report.type,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt
    }
  });
});

/**
 * GET /api/admin/reports
 * List all reports (admin only)
 * Query params: status, type, page, perPage
 */
router.get('/admin/reports', authRequired, roleRequired('admin'), (req, res) => {
  const { status, type, page = 1, perPage = 20 } = req.query;
  
  let reports = read('reports');
  
  // Filter by status
  if (status) {
    reports = reports.filter(r => r.status === status);
  }
  
  // Filter by type
  if (type) {
    reports = reports.filter(r => r.type === type);
  }
  
  // Sort by createdAt descending (newest first)
  reports.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
  
  // Pagination
  const pageNum = parseInt(page, 10);
  const perPageNum = parseInt(perPage, 10);
  const startIndex = (pageNum - 1) * perPageNum;
  const endIndex = startIndex + perPageNum;
  const paginatedReports = reports.slice(startIndex, endIndex);
  
  res.json({
    reports: paginatedReports,
    pagination: {
      page: pageNum,
      perPage: perPageNum,
      total: reports.length,
      totalPages: Math.ceil(reports.length / perPageNum)
    }
  });
});

/**
 * GET /api/admin/reports/pending
 * Get count of pending reports (admin only)
 */
router.get('/admin/reports/pending', authRequired, roleRequired('admin'), (req, res) => {
  const reports = read('reports');
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  
  res.json({ count: pendingCount });
});

/**
 * GET /api/admin/reports/:id
 * Get a specific report (admin only)
 */
router.get('/admin/reports/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const reports = read('reports');
  const report = reports.find(r => r.id === id);
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  res.json({ report });
});

/**
 * POST /api/admin/reports/:id/resolve
 * Resolve a report (admin only)
 * Body: { resolution, action, notes }
 * resolution: 'valid', 'invalid', 'duplicate'
 * action: 'content_removed', 'user_warned', 'user_suspended', 'no_action'
 */
router.post('/admin/reports/:id/resolve', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { resolution, action, notes } = req.body;
  
  if (!resolution) {
    return res.status(400).json({ error: 'Resolution is required' });
  }
  
  const validResolutions = ['valid', 'invalid', 'duplicate'];
  if (!validResolutions.includes(resolution)) {
    return res.status(400).json({ 
      error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` 
    });
  }
  
  const reports = read('reports');
  const reportIndex = reports.findIndex(r => r.id === id);
  
  if (reportIndex === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const report = reports[reportIndex];
  
  if (report.status === 'resolved' || report.status === 'dismissed') {
    return res.status(400).json({ error: 'Report has already been resolved' });
  }
  
  // Update report
  const now = new Date().toISOString();
  report.status = 'resolved';
  report.resolution = resolution;
  report.action = action || 'no_action';
  report.resolutionNotes = notes || '';
  report.resolvedBy = req.user.id;
  report.resolvedByEmail = req.user.email;
  report.resolvedAt = now;
  report.updatedAt = now;
  
  reports[reportIndex] = report;
  write('reports', reports);
  
  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.REPORT_RESOLVED,
    targetType: 'report',
    targetId: id,
    details: {
      reportType: report.type,
      targetId: report.targetId,
      resolution,
      action,
      notes
    }
  });
  
  console.log(`Report ${id} resolved by ${req.user.email}: ${resolution}`);
  
  res.json({ 
    message: 'Report resolved successfully', 
    report 
  });
});

/**
 * POST /api/admin/reports/:id/dismiss
 * Dismiss a report without action (admin only)
 */
router.post('/admin/reports/:id/dismiss', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  const reports = read('reports');
  const reportIndex = reports.findIndex(r => r.id === id);
  
  if (reportIndex === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const report = reports[reportIndex];
  
  // Update report
  const now = new Date().toISOString();
  report.status = 'dismissed';
  report.resolution = 'invalid';
  report.action = 'no_action';
  report.resolutionNotes = notes || 'Dismissed by admin';
  report.resolvedBy = req.user.id;
  report.resolvedByEmail = req.user.email;
  report.resolvedAt = now;
  report.updatedAt = now;
  
  reports[reportIndex] = report;
  write('reports', reports);
  
  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.REPORT_DISMISSED,
    targetType: 'report',
    targetId: id,
    details: {
      reportType: report.type,
      targetId: report.targetId,
      notes
    }
  });
  
  console.log(`Report ${id} dismissed by ${req.user.email}`);
  
  res.json({ 
    message: 'Report dismissed successfully', 
    report 
  });
});

module.exports = router;
