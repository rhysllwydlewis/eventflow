'use strict';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_SENDER_TYPES = new Set(['customer', 'supplier']);

function normalizeStatus(status) {
  if (status === 'in-progress') {
    return 'in_progress';
  }
  if (typeof status === 'string' && VALID_STATUSES.has(status)) {
    return status;
  }
  return 'open';
}

function normalizePriority(priority) {
  if (typeof priority === 'string' && VALID_PRIORITIES.has(priority)) {
    return priority;
  }
  return 'medium';
}

function normalizeSenderType(ticket, fallbackRole = null) {
  const senderType = ticket?.senderType || ticket?.userType || ticket?.role || fallbackRole;
  if (typeof senderType === 'string' && VALID_SENDER_TYPES.has(senderType)) {
    return senderType;
  }
  return null;
}

function normalizeTicketRecord(rawTicket = {}, options = {}) {
  const { generateId, fallbackSenderType = null } = options;
  const ticket = rawTicket && typeof rawTicket === 'object' ? { ...rawTicket } : {};

  const idCandidate = ticket.id || ticket.ticketId || ticket._id;
  ticket.id = typeof idCandidate === 'string' && idCandidate ? idCandidate : null;
  if (!ticket.id && typeof generateId === 'function') {
    ticket.id = generateId();
  }

  ticket.senderType = normalizeSenderType(ticket, fallbackSenderType);
  ticket.senderId = typeof ticket.senderId === 'string' ? ticket.senderId : ticket.userId || null;
  ticket.senderName = ticket.senderName || ticket.userName || ticket.name || '';
  ticket.senderEmail = ticket.senderEmail || ticket.userEmail || ticket.email || '';

  ticket.subject =
    typeof ticket.subject === 'string' && ticket.subject.trim() ? ticket.subject : 'No subject';
  ticket.message =
    typeof ticket.message === 'string'
      ? ticket.message
      : typeof ticket.description === 'string'
        ? ticket.description
        : '';

  ticket.status = normalizeStatus(ticket.status);
  ticket.priority = normalizePriority(ticket.priority);

  if (Array.isArray(ticket.responses)) {
    // keep normalized responses
  } else if (Array.isArray(ticket.replies)) {
    ticket.responses = ticket.replies;
  } else {
    ticket.responses = [];
  }

  delete ticket.replies;

  if (!ticket.createdAt) {
    ticket.createdAt = new Date().toISOString();
  }
  if (!ticket.updatedAt) {
    ticket.updatedAt = ticket.createdAt;
  }

  return ticket;
}

function canUserAccessTicket(user, ticket) {
  if (!user || !ticket) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }

  const normalizedSenderType = normalizeSenderType(ticket);
  const ownerId = ticket.senderId || ticket.userId;
  return ownerId === user.id && normalizedSenderType === user.role;
}

module.exports = {
  normalizeTicketRecord,
  normalizeStatus,
  normalizePriority,
  normalizeSenderType,
  canUserAccessTicket,
};
