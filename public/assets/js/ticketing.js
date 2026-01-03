/**
 * Ticketing System for EventFlow
 * Handles ticket creation, viewing, and responses
 * Uses Firebase Firestore for real-time updates or falls back to MongoDB API
 */

import {
  db,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  isFirebaseAvailable,
} from './firebase-config.js';

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
    this.unsubscribers = [];
    this.useFirebase = isFirebaseAvailable;
  }

  /**
   * Create a new support ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<string>} Ticket ID
   */
  async createTicket(ticketData) {
    if (!this.useFirebase) {
      // Fallback to MongoDB API
      return this.createTicketViaAPI(ticketData);
    }

    try {
      const ticket = {
        senderId: ticketData.senderId,
        senderType: ticketData.senderType, // 'customer' | 'supplier'
        senderName: ticketData.senderName,
        senderEmail: ticketData.senderEmail,
        subject: ticketData.subject,
        message: ticketData.message,
        status: 'open', // 'open' | 'in_progress' | 'resolved' | 'closed'
        priority: ticketData.priority || 'medium', // 'low' | 'medium' | 'high'
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responses: [],
      };

      const docRef = await addDoc(collection(db, 'tickets'), ticket);
      console.log('Ticket created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  async createTicketViaAPI(ticketData) {
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        credentials: 'include',
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      const data = await response.json();
      return data.ticketId;
    } catch (error) {
      console.error('Error creating ticket via API:', error);
      throw error;
    }
  }

  /**
   * Get all tickets for a specific user
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @returns {Promise<Array>} Array of tickets
   */
  async getUserTickets(userId, userType) {
    try {
      const q = query(
        collection(db, 'tickets'),
        where('senderId', '==', userId),
        where('senderType', '==', userType),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(doc => {
        tickets.push({ id: doc.id, ...doc.data() });
      });

      return tickets;
    } catch (error) {
      console.error('Error getting user tickets:', error);
      throw error;
    }
  }

  /**
   * Get all tickets (admin only)
   * @returns {Promise<Array>} Array of all tickets
   */
  async getAllTickets() {
    try {
      const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));

      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(doc => {
        tickets.push({ id: doc.id, ...doc.data() });
      });

      return tickets;
    } catch (error) {
      console.error('Error getting all tickets:', error);
      throw error;
    }
  }

  /**
   * Get a single ticket by ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object|null>} Ticket data or null
   */
  async getTicket(ticketId) {
    try {
      const docRef = doc(db, 'tickets', ticketId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting ticket:', error);
      throw error;
    }
  }

  /**
   * Add a response to a ticket
   * Uses arrayUnion for atomic operation to prevent race conditions
   * @param {string} ticketId - Ticket ID
   * @param {Object} responseData - Response data
   */
  async addResponse(ticketId, responseData) {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);

      const newResponse = {
        responderId: responseData.responderId,
        responderType: responseData.responderType, // 'admin' | 'customer' | 'supplier'
        responderName: responseData.responderName,
        message: responseData.message,
        timestamp: serverTimestamp(),
      };

      // Use arrayUnion for atomic array operation (prevents race conditions)
      await updateDoc(ticketRef, {
        responses: arrayUnion(newResponse),
        updatedAt: serverTimestamp(),
      });

      console.log('Response added to ticket:', ticketId);
    } catch (error) {
      console.error('Error adding response:', error);
      throw error;
    }
  }

  /**
   * Update ticket status
   * @param {string} ticketId - Ticket ID
   * @param {string} status - New status
   */
  async updateStatus(ticketId, status) {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, {
        status: status,
        updatedAt: serverTimestamp(),
      });

      console.log('Ticket status updated:', ticketId, status);
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }
  }

  /**
   * Listen to user tickets in real-time
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   */
  listenToUserTickets(userId, userType, callback) {
    if (!this.useFirebase) {
      // Fallback: Fetch tickets once via API
      this.fetchUserTicketsViaAPI(userId, userType, callback);
      return () => {}; // No-op unsubscribe
    }

    try {
      const q = query(
        collection(db, 'tickets'),
        where('senderId', '==', userId),
        where('senderType', '==', userType),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        querySnapshot => {
          const tickets = [];
          querySnapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
          });
          callback(tickets);
        },
        error => {
          console.error('Error listening to user tickets:', error);
          // Still call callback with empty array but log the error
          callback([]);
        }
      );

      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up ticket listener:', error);
      // Show user-friendly message
      showToastIfAvailable('error', 'Unable to load tickets. Please refresh the page.');
      callback([]);
      return () => {};
    }
  }

  async fetchUserTicketsViaAPI(userId, userType, callback) {
    try {
      const response = await fetch(`/api/tickets?userId=${userId}&userType=${userType}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        callback(data.tickets || []);
      } else {
        console.error('Failed to fetch tickets:', response.status, response.statusText);
        showToastIfAvailable('error', 'Unable to load tickets. Please try again later.');
        callback([]);
      }
    } catch (error) {
      console.error('Error fetching tickets via API:', error);
      showToastIfAvailable('error', 'Network error loading tickets. Please check your connection.');
      callback([]);
    }
  }

  /**
   * Listen to all tickets in real-time (admin only)
   * @param {Function} callback - Callback function
   */
  listenToAllTickets(callback) {
    try {
      const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        querySnapshot => {
          const tickets = [];
          querySnapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
          });
          callback(tickets);
        },
        error => {
          console.error('Error listening to all tickets:', error);
        }
      );

      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up ticket listener:', error);
      throw error;
    }
  }

  /**
   * Listen to a specific ticket in real-time
   * @param {string} ticketId - Ticket ID
   * @param {Function} callback - Callback function
   */
  listenToTicket(ticketId, callback) {
    if (!this.useFirebase) {
      // Fallback: Fetch ticket once via API
      this.fetchTicketViaAPI(ticketId, callback);
      return () => {}; // No-op unsubscribe
    }

    try {
      const docRef = doc(db, 'tickets', ticketId);

      const unsubscribe = onSnapshot(
        docRef,
        docSnap => {
          if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() });
          } else {
            callback(null);
          }
        },
        error => {
          console.error('Error listening to ticket:', error);
          callback(null);
        }
      );

      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up ticket listener:', error);
      callback(null);
      return () => {};
    }
  }

  async fetchTicketViaAPI(ticketId, callback) {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        callback(data.ticket || null);
      } else {
        console.error('Failed to fetch ticket');
        callback(null);
      }
    } catch (error) {
      console.error('Error fetching ticket via API:', error);
      callback(null);
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  /**
   * Format timestamp for display
   * @param {Timestamp} timestamp - Firestore timestamp
   * @returns {string} Formatted date string
   */
  formatTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get status badge color
   * @param {string} status - Ticket status
   * @returns {string} CSS class
   */
  getStatusClass(status) {
    const classes = {
      open: 'badge-info',
      in_progress: 'badge-warning',
      resolved: 'badge-success',
      closed: 'badge-secondary',
    };
    return classes[status] || 'badge-secondary';
  }

  /**
   * Get priority badge color
   * @param {string} priority - Ticket priority
   * @returns {string} CSS class
   */
  getPriorityClass(priority) {
    const classes = {
      low: 'badge-secondary',
      medium: 'badge-warning',
      high: 'badge-danger',
    };
    return classes[priority] || 'badge-secondary';
  }
}

// Export singleton instance
const ticketingSystem = new TicketingSystem();
export default ticketingSystem;
