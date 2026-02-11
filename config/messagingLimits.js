/**
 * Message Limits Configuration
 * Defines messaging limits based on subscription tier
 */

'use strict';

const MESSAGE_LIMITS = {
  free: {
    messagesPerDay: 10,
    threadsPerDay: 3,
    maxMessageLength: 500,
  },
  pro: {
    messagesPerDay: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 5000, // Pro users get standard message length
  },
  pro_plus: {
    messagesPerDay: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 10000, // Pro+ users get longer messages for detailed communication
  },
  enterprise: {
    messagesPerDay: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 50000, // Enterprise gets very long messages for complex requirements
  },
};

module.exports = { MESSAGE_LIMITS };
