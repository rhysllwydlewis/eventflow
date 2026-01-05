/**
 * Winston Logger Configuration
 * Provides structured logging with different levels and formats
 */

'use strict';

const winston = require('winston');
const path = require('path');

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: fileFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add file transports only in production
if (isProduction) {
  // Error log file
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create a stream object for Morgan HTTP logger integration
logger.stream = {
  write: message => {
    logger.info(message.trim());
  },
};

module.exports = logger;
