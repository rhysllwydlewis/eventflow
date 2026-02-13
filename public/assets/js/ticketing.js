/**
 * Ticketing System for EventFlow
 * Handles ticket creation, viewing, status updates, and replies
 */

/**
 * Show a toast notification if Toast library is available
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} message - Message to display
 */
function showToastIfAvailable(type, message) {
  if (typeof Toast !== 'undefined' && Toast[type]) {
    Toast[type](message);
  }
}

class TicketingSystem {
  constructor() {
    this.pollingIntervals = [];
    this.apiBase = '/api';
    this._pollingNotificationShown = false;
  }

  async ensureCsrfToken(forceRefresh = false) {
    if (typeof window.ensureCsrfToken === 'function') {
      return window.ensureCsrfToken(forceRefresh);
    }

    if (forceRefresh) {
      window.__CSRF_TOKEN__ = null;
      window.csrfToken = null;
    }

    if (window.__CSRF_TOKEN__) {
      return window.__CSRF_TOKEN__;
    }

    const response = await fetch('/api/v1/csrf-token', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }

    const data = await response.json();
    if (!data?.csrfToken) {
      throw new Error('CSRF token missing from response');
    }

    window.__CSRF_TOKEN__ = data.csrfToken;
    window.csrfToken = data.csrfToken;
    return data.csrfToken;
  }

  async request(url, options = {}) {
    const isWriteMethod =
      options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase());

    const opts = {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    if (isWriteMethod) {
      const csrfToken = await this.ensureCsrfToken();
      opts.headers['X-CSRF-Token'] = csrfToken;
    }

    let response = await fetch(url, opts);
    let data = await response.json().catch(() => ({}));

    const csrfError = response.status === 403 && /csrf/i.test(data?.error || '') && isWriteMethod;

    // CSRF tokens can expire/rotate; refresh once and retry automatically.
    if (csrfError) {
      window.__CSRF_TOKEN__ = null;
      window.csrfToken = null;
      const freshToken = await this.ensureCsrfToken(true);
      response = await fetch(url, {
        ...opts,
        headers: {
          ...opts.headers,
          'X-CSRF-Token': freshToken,
        },
      });
      data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      throw new Error(data.error || 'Ticket request failed');
    }

    return data;
  }

  normalizeTicket(rawTicket = {}) {
    const ticket = rawTicket && typeof rawTicket === 'object' ? { ...rawTicket } : {};

    const fallbackMessage =
      typeof ticket.description === 'string' && ticket.description.trim().length > 0
        ? ticket.description
        : '';

    ticket.status = typeof ticket.status === 'string' && ticket.status ? ticket.status : 'open';
    ticket.priority =
      typeof ticket.priority === 'string' && ticket.priority ? ticket.priority : 'medium';
    ticket.subject = typeof ticket.subject === 'string' ? ticket.subject : 'No subject';
    ticket.message = typeof ticket.message === 'string' ? ticket.message : fallbackMessage;

    if (Array.isArray(ticket.responses)) {
      // keep as-is
    } else if (Array.isArray(ticket.replies)) {
      ticket.responses = ticket.replies;
    } else {
      ticket.responses = [];
    }

    return ticket;
  }

  async createTicket(ticketData) {
    const data = await this.request(`${this.apiBase}/tickets`, {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
    return this.normalizeTicket(data.ticket);
  }

  async getUserTickets(_userId, _userType, limit = null) {
    let url = `${this.apiBase}/tickets`;
    if (limit) {
      url += `?limit=${encodeURIComponent(limit)}`;
    }
    const data = await this.request(url);
    return (data.tickets || []).map(ticket => this.normalizeTicket(ticket));
  }

  async getTicket(ticketId) {
    const data = await this.request(`${this.apiBase}/tickets/${ticketId}`);
    return this.normalizeTicket(data.ticket);
  }

  async addResponse(ticketId, message) {
    const data = await this.request(`${this.apiBase}/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return this.normalizeTicket(data.ticket);
  }

  async updateTicket(ticketId, updates) {
    const data = await this.request(`${this.apiBase}/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return this.normalizeTicket(data.ticket);
  }

  async updateStatus(ticketId, status) {
    return this.updateTicket(ticketId, { status });
  }

  async updatePriority(ticketId, priority) {
    return this.updateTicket(ticketId, { priority });
  }

  async closeTicket(ticketId) {
    return this.updateStatus(ticketId, 'closed');
  }

  async reopenTicket(ticketId) {
    return this.updateStatus(ticketId, 'open');
  }

  listenToTicket(ticketId, callback) {
    if (!this._pollingNotificationShown) {
      this._pollingNotificationShown = true;
      showToastIfAvailable('info', 'Ticket updates refresh automatically every 5 seconds.');
    }

    const pollTicket = async () => {
      try {
        const ticket = await this.getTicket(ticketId);
        callback(ticket);
      } catch (error) {
        console.error('Error polling ticket:', error);
      }
    };

    pollTicket();
    const pollInterval = setInterval(pollTicket, 5000);

    this.pollingIntervals.push(pollInterval);

    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  listenToUserTickets(userId, userType, callback, limit = null) {
    const pollTickets = async () => {
      try {
        const tickets = await this.getUserTickets(userId, userType, limit);
        callback(tickets);
      } catch (error) {
        console.error('Error polling user tickets:', error);
        callback([]);
      }
    };

    pollTickets();
    const pollInterval = setInterval(pollTickets, 5000);

    this.pollingIntervals.push(pollInterval);

    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  cleanup() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];
  }

  getStatusClass(status) {
    const statusClasses = {
      open: 'badge-open',
      in_progress: 'badge-in_progress',
      resolved: 'badge-resolved',
      closed: 'badge-closed',
    };
    return statusClasses[status] || 'badge-default';
  }

  getPriorityClass(priority) {
    const priorityClasses = {
      low: 'badge-priority-low',
      medium: 'badge-priority-medium',
      high: 'badge-priority-high',
      urgent: 'badge-priority-urgent',
    };
    return priorityClasses[priority] || 'badge-priority-medium';
  }

  formatTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

const ticketingSystem = new TicketingSystem();

export { ticketingSystem, showToastIfAvailable };
export default ticketingSystem;
