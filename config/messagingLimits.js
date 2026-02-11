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
    messagesPerDay: 50,
    threadsPerDay: 10,
    maxMessageLength: 2000,
  },
  pro_plus: {
    messagesPerDay: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 10000,
  },
  enterprise: {
    messagesPerDay: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 50000,
  },
};

module.exports = { MESSAGE_LIMITS };
