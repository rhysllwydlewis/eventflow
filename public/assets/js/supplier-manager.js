/**
 * Supplier Management Module for EventFlow
 * Handles supplier CRUD operations with Firebase Firestore
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
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from './firebase-config.js';

class SupplierManager {
  constructor() {
    this.unsubscribers = [];
  }

  /**
   * Create a new supplier
   * @param {Object} supplierData - Supplier information
   * @returns {Promise<string>} Supplier ID
   */
  async createSupplier(supplierData) {
    try {
      const supplierId = supplierData.id || this.generateId();
      const supplierRef = doc(db, 'suppliers', supplierId);
      
      const data = {
        ...supplierData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        approved: supplierData.approved !== undefined ? supplierData.approved : false,
        verified: supplierData.verified !== undefined ? supplierData.verified : false
      };
      
      await setDoc(supplierRef, data);
      console.log('Supplier created:', supplierId);
      return supplierId;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  }

  /**
   * Get supplier by ID
   * @param {string} supplierId - Supplier ID
   * @returns {Promise<Object|null>} Supplier data
   */
  async getSupplier(supplierId) {
    try {
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierSnap = await getDoc(supplierRef);
      
      if (!supplierSnap.exists()) {
        return null;
      }
      
      return { id: supplierSnap.id, ...supplierSnap.data() };
    } catch (error) {
      console.error('Error getting supplier:', error);
      throw error;
    }
  }

  /**
   * Get all suppliers
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of suppliers
   */
  async getAllSuppliers(options = {}) {
    try {
      let q = collection(db, 'suppliers');
      
      // Apply filters
      const constraints = [];
      
      if (options.approved !== undefined) {
        constraints.push(where('approved', '==', options.approved));
      }
      
      if (options.verified !== undefined) {
        constraints.push(where('verified', '==', options.verified));
      }
      
      if (options.ownerUserId) {
        constraints.push(where('ownerUserId', '==', options.ownerUserId));
      }
      
      if (options.category) {
        constraints.push(where('category', '==', options.category));
      }
      
      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
      }
      
      if (constraints.length > 0) {
        q = query(collection(db, 'suppliers'), ...constraints);
      }
      
      const querySnapshot = await getDocs(q);
      const suppliers = [];
      
      querySnapshot.forEach((doc) => {
        suppliers.push({ id: doc.id, ...doc.data() });
      });
      
      return suppliers;
    } catch (error) {
      console.error('Error getting suppliers:', error);
      throw error;
    }
  }

  /**
   * Update supplier
   * @param {string} supplierId - Supplier ID
   * @param {Object} updates - Fields to update
   */
  async updateSupplier(supplierId, updates) {
    try {
      const supplierRef = doc(db, 'suppliers', supplierId);
      
      await updateDoc(supplierRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      console.log('Supplier updated:', supplierId);
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  }

  /**
   * Delete supplier
   * @param {string} supplierId - Supplier ID
   */
  async deleteSupplier(supplierId) {
    try {
      const supplierRef = doc(db, 'suppliers', supplierId);
      await deleteDoc(supplierRef);
      console.log('Supplier deleted:', supplierId);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  /**
   * Listen to supplier changes in real-time
   * @param {string} supplierId - Supplier ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToSupplier(supplierId, callback) {
    try {
      const supplierRef = doc(db, 'suppliers', supplierId);
      
      const unsubscribe = onSnapshot(supplierRef, (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() });
        } else {
          callback(null);
        }
      }, (error) => {
        console.error('Error listening to supplier:', error);
        callback(null);
      });
      
      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up supplier listener:', error);
      throw error;
    }
  }

  /**
   * Listen to all suppliers with filters
   * @param {Object} options - Query options
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToSuppliers(options = {}, callback) {
    try {
      let q = collection(db, 'suppliers');
      
      const constraints = [];
      
      if (options.approved !== undefined) {
        constraints.push(where('approved', '==', options.approved));
      }
      
      if (options.verified !== undefined) {
        constraints.push(where('verified', '==', options.verified));
      }
      
      if (options.ownerUserId) {
        constraints.push(where('ownerUserId', '==', options.ownerUserId));
      }
      
      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
      }
      
      if (constraints.length > 0) {
        q = query(collection(db, 'suppliers'), ...constraints);
      }
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const suppliers = [];
        querySnapshot.forEach((doc) => {
          suppliers.push({ id: doc.id, ...doc.data() });
        });
        callback(suppliers);
      }, (error) => {
        console.error('Error listening to suppliers:', error);
        callback([]);
      });
      
      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up suppliers listener:', error);
      throw error;
    }
  }

  /**
   * Approve/unapprove supplier
   * @param {string} supplierId - Supplier ID
   * @param {boolean} approved - Approval status
   */
  async setApprovalStatus(supplierId, approved) {
    try {
      await this.updateSupplier(supplierId, { approved });
      console.log(`Supplier ${supplierId} ${approved ? 'approved' : 'unapproved'}`);
    } catch (error) {
      console.error('Error setting approval status:', error);
      throw error;
    }
  }

  /**
   * Verify/unverify supplier
   * @param {string} supplierId - Supplier ID
   * @param {boolean} verified - Verification status
   */
  async setVerificationStatus(supplierId, verified) {
    try {
      await this.updateSupplier(supplierId, { verified });
      console.log(`Supplier ${supplierId} ${verified ? 'verified' : 'unverified'}`);
    } catch (error) {
      console.error('Error setting verification status:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID for supplier
   * Uses crypto API for better uniqueness guarantees
   * @returns {string} Supplier ID
   */
  generateId() {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'sup_' + crypto.randomUUID().replace(/-/g, '');
    }
    // Fallback for older browsers
    return 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
const supplierManager = new SupplierManager();

export default supplierManager;
