/**
 * Customer Management Module for EventFlow
 * Handles customer CRUD operations with Firebase Firestore
 */

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from './firebase-config.js';

class CustomerManager {
  constructor() {
    this.unsubscribers = [];
  }

  /**
   * Create or update customer profile
   * @param {string} userId - User ID
   * @param {Object} customerData - Customer information
   * @returns {Promise<string>} Customer ID
   */
  async saveCustomer(userId, customerData) {
    try {
      const customerRef = doc(db, 'customers', userId);

      const data = {
        ...customerData,
        userId: userId,
        updatedAt: serverTimestamp(),
      };

      // Check if customer exists
      const customerSnap = await getDoc(customerRef);

      if (!customerSnap.exists()) {
        data.createdAt = serverTimestamp();
      }

      await setDoc(customerRef, data, { merge: true });
      console.log('Customer saved:', userId);
      return userId;
    } catch (error) {
      console.error('Error saving customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Customer data
   */
  async getCustomer(userId) {
    try {
      const customerRef = doc(db, 'customers', userId);
      const customerSnap = await getDoc(customerRef);

      if (!customerSnap.exists()) {
        return null;
      }

      return { id: customerSnap.id, ...customerSnap.data() };
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Get all customers
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of customers
   */
  async getAllCustomers(options = {}) {
    try {
      let q = collection(db, 'customers');

      const constraints = [];

      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
      }

      if (constraints.length > 0) {
        q = query(collection(db, 'customers'), ...constraints);
      }

      const querySnapshot = await getDocs(q);
      const customers = [];

      querySnapshot.forEach(doc => {
        customers.push({ id: doc.id, ...doc.data() });
      });

      return customers;
    } catch (error) {
      console.error('Error getting customers:', error);
      throw error;
    }
  }

  /**
   * Update customer profile
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   */
  async updateCustomer(userId, updates) {
    try {
      const customerRef = doc(db, 'customers', userId);

      await updateDoc(customerRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      console.log('Customer updated:', userId);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  /**
   * Delete customer
   * @param {string} userId - User ID
   */
  async deleteCustomer(userId) {
    try {
      const customerRef = doc(db, 'customers', userId);
      await deleteDoc(customerRef);
      console.log('Customer deleted:', userId);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  /**
   * Listen to customer changes in real-time
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToCustomer(userId, callback) {
    try {
      const customerRef = doc(db, 'customers', userId);

      const unsubscribe = onSnapshot(
        customerRef,
        doc => {
          if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
          } else {
            callback(null);
          }
        },
        error => {
          console.error('Error listening to customer:', error);
          callback(null);
        }
      );

      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up customer listener:', error);
      throw error;
    }
  }

  /**
   * Listen to all customers
   * @param {Object} options - Query options
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToCustomers(options = {}, callback) {
    try {
      let q = collection(db, 'customers');

      const constraints = [];

      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
      }

      if (constraints.length > 0) {
        q = query(collection(db, 'customers'), ...constraints);
      }

      const unsubscribe = onSnapshot(
        q,
        querySnapshot => {
          const customers = [];
          querySnapshot.forEach(doc => {
            customers.push({ id: doc.id, ...doc.data() });
          });
          callback(customers);
        },
        error => {
          console.error('Error listening to customers:', error);
          callback([]);
        }
      );

      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up customers listener:', error);
      throw error;
    }
  }

  /**
   * Get customer's favorite suppliers
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of supplier IDs
   */
  async getFavorites(userId) {
    try {
      const customer = await this.getCustomer(userId);
      return customer?.favorites || [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Add supplier to favorites
   * @param {string} userId - User ID
   * @param {string} supplierId - Supplier ID
   */
  async addFavorite(userId, supplierId) {
    try {
      const customer = await this.getCustomer(userId);
      const favorites = customer?.favorites || [];

      if (!favorites.includes(supplierId)) {
        favorites.push(supplierId);
        await this.updateCustomer(userId, { favorites });
        console.log('Added to favorites:', supplierId);
      }
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove supplier from favorites
   * @param {string} userId - User ID
   * @param {string} supplierId - Supplier ID
   */
  async removeFavorite(userId, supplierId) {
    try {
      const customer = await this.getCustomer(userId);
      const favorites = customer?.favorites || [];

      const index = favorites.indexOf(supplierId);
      if (index > -1) {
        favorites.splice(index, 1);
        await this.updateCustomer(userId, { favorites });
        console.log('Removed from favorites:', supplierId);
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }
}

// Create singleton instance
const customerManager = new CustomerManager();

export default customerManager;
