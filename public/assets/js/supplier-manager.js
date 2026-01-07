/**
 * Supplier Management Module for EventFlow
 * Handles supplier CRUD operations via MongoDB API
 *
 * NOTE: This module has been migrated from Firebase to MongoDB.
 * All operations now use the EventFlow REST API backed by MongoDB.
 */

class SupplierManager {
  constructor() {
    this.pollingIntervals = [];
    this.apiBase = '/api';
  }

  /**
   * Create a new supplier via MongoDB API
   * @param {Object} supplierData - Supplier information
   * @returns {Promise<string>} Supplier ID
   */
  async createSupplier(supplierData) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(supplierData),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create supplier' }));
        throw new Error(error.error || 'Failed to create supplier');
      }

      const result = await response.json();
      console.log('Supplier created:', result.id);
      return result.id;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  }

  /**
   * Get supplier by ID via MongoDB API
   * @param {string} supplierId - Supplier ID
   * @returns {Promise<Object|null>} Supplier data
   */
  async getSupplier(supplierId) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch supplier');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting supplier:', error);
      throw error;
    }
  }

  /**
   * Get all suppliers via MongoDB API
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of suppliers
   */
  async getAllSuppliers(options = {}) {
    try {
      const params = new URLSearchParams();

      if (options.approved !== undefined) {
        params.append('approved', options.approved);
      }
      if (options.verified !== undefined) {
        params.append('verified', options.verified);
      }
      if (options.ownerUserId) {
        params.append('ownerUserId', options.ownerUserId);
      }
      if (options.category) {
        params.append('category', options.category);
      }

      const response = await fetch(`${this.apiBase}/suppliers?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting suppliers:', error);
      throw error;
    }
  }

  /**
   * Update supplier via MongoDB API
   * @param {string} supplierId - Supplier ID
   * @param {Object} updates - Fields to update
   */
  async updateSupplier(supplierId, updates) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update supplier');
      }

      console.log('Supplier updated:', supplierId);
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  }

  /**
   * Delete supplier via MongoDB API
   * @param {string} supplierId - Supplier ID
   */
  async deleteSupplier(supplierId) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete supplier');
      }

      console.log('Supplier deleted:', supplierId);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  /**
   * Listen to supplier changes using polling
   * (MongoDB doesn't have real-time updates like Firebase)
   * @param {string} supplierId - Supplier ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToSupplier(supplierId, callback) {
    console.warn('Real-time updates not available with MongoDB. Using polling instead.');

    const pollInterval = setInterval(async () => {
      try {
        const supplier = await this.getSupplier(supplierId);
        callback(supplier);
      } catch (error) {
        console.error('Error polling supplier:', error);
        callback(null);
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
   * Listen to all suppliers with filters using polling
   * @param {Object} options - Query options
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToSuppliers(options = {}, callback) {
    console.warn('Real-time updates not available with MongoDB. Using polling instead.');

    const pollInterval = setInterval(async () => {
      try {
        const suppliers = await this.getAllSuppliers(options);
        callback(suppliers);
      } catch (error) {
        console.error('Error polling suppliers:', error);
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
      return `sup_${crypto.randomUUID().replace(/-/g, '')}`;
    }
    // Fallback for older browsers
    return `sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up all polling intervals
   */
  cleanup() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];
  }
}

// Create singleton instance
const supplierManager = new SupplierManager();

export default supplierManager;
