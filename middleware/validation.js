/**
 * Validation Middleware
 * Provides input validation helpers using express-validator
 */

'use strict';

const { body, param, query, validationResult } = require('express-validator');

/**
 * Check if password meets minimum requirements
 * Must be at least 8 characters with letters and numbers
 * @param {string} pw - Password to validate
 * @returns {boolean} True if password is valid
 */
function passwordOk(pw = '') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/**
 * Validation middleware to check results and return errors
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Validation for user registration
 */
const validateUserRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  validate,
];

/**
 * Validation for user login
 */
const validateUserLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

/**
 * Validation for password reset request
 */
const validatePasswordResetRequest = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  validate,
];

/**
 * Validation for password reset
 */
const validatePasswordReset = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('token').notEmpty().withMessage('Reset token is required'),
  validate,
];

/**
 * Validation for package creation
 */
const validatePackageCreation = [
  body('name').trim().notEmpty().withMessage('Package name is required'),
  body('description').optional().trim(),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('supplierId').isMongoId().withMessage('Invalid supplier ID'),
  validate,
];

/**
 * Validation for package update
 */
const validatePackageUpdate = [
  param('id').isMongoId().withMessage('Invalid package ID'),
  body('name').optional().trim().notEmpty().withMessage('Package name cannot be empty'),
  body('description').optional().trim(),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  validate,
];

/**
 * Validation for review submission
 */
const validateReviewSubmission = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim(),
  body('packageId').isMongoId().withMessage('Invalid package ID'),
  validate,
];

/**
 * Validation for search queries
 */
const validateSearch = [
  query('q').optional().trim().isLength({ max: 200 }).withMessage('Search query too long'),
  query('category').optional().trim(),
  query('location').optional().trim(),
  validate,
];

/**
 * Validation for MongoDB ObjectId in params
 */
const validateObjectId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  validate,
];

module.exports = {
  passwordOk,
  validate,
  validateUserRegistration,
  validateUserLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validatePackageCreation,
  validatePackageUpdate,
  validateReviewSubmission,
  validateSearch,
  validateObjectId,
  // Export express-validator methods for custom validators
  body,
  param,
  query,
  validationResult,
};
