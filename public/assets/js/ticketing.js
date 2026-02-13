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

class TicketingError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'TicketingError';
    this.status = status;
  }
}

class TicketingSystem {
  constructor() {
    this.activePollers = new Set();
    this.apiBase = '/api';
    this._pollingNotificationShown = false;
    this.defaultPollIntervalMs = 5000;
    this.maxPollIntervalMs = 30000;
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
      throw new TicketingError(data.error || 'Ticket request failed', response.status);
    }

    return data;
  }

  normalizeTicket(rawTicket = {}) {
    const ticket = rawTicket && typeof rawTicket === 'object' ? { ...rawTicket } : {};

    const fallbackMessage =
      typeof ticket.description === 'string' && ticket.description.trim().length > 0
        ? ticket.description
        : '';

    ticket.id = typeof ticket.id === 'string' && ticket.id ? ticket.id : ticket.ticketId || null;
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

  createPoller(task, callback, { silentOnAuthError = true, onAuthError = null } = {}) {
    let cancelled = false;
    let timer = null;
    let intervalMs = this.defaultPollIntervalMs;

    const stop = () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      this.activePollers.delete(stop);
    };

    const run = async () => {
      if (cancelled) {
        return;
      }

      try {
        const result = await task();
        callback(result);
        intervalMs = this.defaultPollIntervalMs;
      } catch (error) {
        const isAuthError = error instanceof TicketingError && [401, 403].includes(error.status);

        if (isAuthError && silentOnAuthError) {
          if (typeof onAuthError === 'function') {
            onAuthError();
          }
          stop();
          return;
        }

        console.error('Ticket polling failed:', error);
        intervalMs = Math.min(intervalMs * 2, this.maxPollIntervalMs);
      }

      timer = setTimeout(run, intervalMs);
    };

    this.activePollers.add(stop);
    run();
    return stop;
  }

  async createTicket(ticketData) {
    const data = await this.request(`${this.apiBase}/tickets`, {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
    return this.normalizeTicket(data.ticket);
  }

  async getUserTickets(_userId, _userType, limit = null, options = {}) {
    const params = new URLSearchParams();
    if (limit) {
      params.set('limit', String(limit));
    }
    if (typeof options.status === 'string' && options.status) {
      params.set('status', options.status);
    }
    if (typeof options.sort === 'string' && options.sort) {
      params.set('sort', options.sort);
    }
    if (typeof options.query === 'string' && options.query.trim()) {
      params.set('q', options.query.trim());
    }

    let url = `${this.apiBase}/tickets`;
    if (params.toString()) {
      url += `?${params.toString()}`;
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

    return this.createPoller(() => this.getTicket(ticketId), callback, {
      silentOnAuthError: true,
      onAuthError: () => callback(null),
    });
  }

  listenToUserTickets(userId, userType, callback, limit = null, options = {}) {
    return this.createPoller(
      () => this.getUserTickets(userId, userType, limit, options),
      callback,
      {
        silentOnAuthError: true,
        onAuthError: () => callback([]),
      }
    );
  }

  cleanup() {
    this.activePollers.forEach(stop => stop());
    this.activePollers.clear();
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
