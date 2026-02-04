/**
 * Ticketing System for EventFlow
 * Handles ticket creation, viewing, and responses
 * Uses MongoDB API exclusively
 *
 * NOTE: This module has been migrated from Firebase to MongoDB.
 * All operations now use the EventFlow REST API backed by MongoDB.
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
    this._pollingNotificationShown = false; // Track if we've shown the polling notification
  }

  /**
   * Create a new support ticket via MongoDB API
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<string>} Ticket ID
   */
  async createTicket(ticketData) {
    try {
      const response = await fetch(`${this.apiBase}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      const data = await response.json();
      console.log('Ticket created with ID:', data.ticketId);
      return data.ticketId;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Get all tickets for a specific user via MongoDB API
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @returns {Promise<Array>} Array of tickets
   */
  async getUserTickets(userId, userType, limit = null) {
    try {
      let url = `${this.apiBase}/tickets?userId=${userId}&userType=${userType}`;
      if (limit) {
        url += `&limit=${limit}`;
      }
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      return data.tickets || [];
    } catch (error) {
      console.error('Error getting user tickets:', error);
      throw error;
    }
  }

  /**
   * Get a specific ticket by ID via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>} Ticket data
   */
  async getTicket(ticketId) {
    try {
      const response = await fetch(`${this.apiBase}/tickets/${ticketId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ticket');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting ticket:', error);
      throw error;
    }
  }

  /**
   * Add a response to a ticket via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @param {Object} responseData - Response data
   * @returns {Promise<void>}
   */
  async addResponse(ticketId, responseData) {
    try {
      const response = await fetch(`${this.apiBase}/tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(responseData),
      });

      if (!response.ok) {
        throw new Error('Failed to add response');
      }

      console.log('Response added to ticket:', ticketId);
    } catch (error) {
      console.error('Error adding response:', error);
      throw error;
    }
  }

  /**
   * Update ticket status via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async updateStatus(ticketId, status) {
    try {
      const response = await fetch(`${this.apiBase}/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      console.log('Ticket status updated:', ticketId, status);
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }

  /**
   * Update ticket priority via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @param {string} priority - New priority
   * @returns {Promise<void>}
   */
  async updatePriority(ticketId, priority) {
    try {
      const response = await fetch(`${this.apiBase}/tickets/${ticketId}/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      console.log('Ticket priority updated:', ticketId, priority);
    } catch (error) {
      console.error('Error updating priority:', error);
      throw error;
    }
  }

  /**
   * Close a ticket via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<void>}
   */
  async closeTicket(ticketId) {
    return this.updateStatus(ticketId, 'closed');
  }

  /**
   * Reopen a ticket via MongoDB API
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<void>}
   */
  async reopenTicket(ticketId) {
    return this.updateStatus(ticketId, 'open');
  }

  /**
   * Listen to ticket updates using polling
   * (MongoDB doesn't have real-time updates like Firebase)
   * @param {string} ticketId - Ticket ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToTicket(ticketId, callback) {
    // Show user-facing notification only once
    if (!this._pollingNotificationShown) {
      this._pollingNotificationShown = true;
      if (typeof Toast !== 'undefined' && Toast.info) {
        Toast.info('Using polling for ticket updates (refreshes every 5 seconds)', {
          duration: 5000
        });
      }
    }

    const pollInterval = setInterval(async () => {
      try {
        const ticket = await this.getTicket(ticketId);
        callback(ticket);
      } catch (error) {
        console.error('Error polling ticket:', error);
      }
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  /**
   * Listen to user tickets using polling
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUserTickets(userId, userType, callback, limit = null) {
    // Silently use polling - no need to notify for each ticket

    const pollInterval = setInterval(async () => {
      try {
        const tickets = await this.getUserTickets(userId, userType, limit);
        callback(tickets);
      } catch (error) {
        console.error('Error polling user tickets:', error);
        callback([]);
      }
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  /**
   * Clean up all polling intervals
   */
  cleanup() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];
  }

  /**
   * Get CSS class for ticket status badge
   * @param {string} status - Ticket status
   * @returns {string} CSS class name
   */
  getStatusClass(status) {
    const statusClasses = {
      open: 'badge-open',
      in_progress: 'badge-progress',
      resolved: 'badge-resolved',
      closed: 'badge-closed',
    };
    return statusClasses[status] || 'badge-default';
  }

  /**
   * Get CSS class for ticket priority badge
   * @param {string} priority - Ticket priority
   * @returns {string} CSS class name
   */
  getPriorityClass(priority) {
    const priorityClasses = {
      low: 'badge-priority-low',
      medium: 'badge-priority-medium',
      high: 'badge-priority-high',
    };
    return priorityClasses[priority] || 'badge-priority-medium';
  }

  /**
   * Format timestamp for display
   * @param {string|Date} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
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

// Create singleton instance
const ticketingSystem = new TicketingSystem();

export { ticketingSystem, showToastIfAvailable };
export default ticketingSystem;
