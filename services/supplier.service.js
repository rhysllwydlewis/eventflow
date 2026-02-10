/**
 * Supplier Service
 * Handles supplier management and business logic
 */

'use strict';

const { NotFoundError, ValidationError, AuthorizationError } = require('../errors');
const logger = require('../utils/logger');
const { paginationHelper } = require('../utils/database');

class SupplierService {
  constructor(dbUnified, uid) {
    this.db = dbUnified;
    this.uid = uid;
  }

  /**
   * Create supplier profile
   * @param {Object} data - Supplier data
   * @param {string} userId - User ID creating the profile
   * @returns {Promise<Object>} - Created supplier
   */
  async createSupplier(data, userId) {
    // Validate required fields
    if (!data.name) {
      throw new ValidationError('Supplier name is required');
    }
    if (!data.category) {
      throw new ValidationError('Category is required');
    }

    // Check if user already has a supplier profile
    const suppliers = await this.db.read('suppliers');
    const existing = suppliers.find(s => s.ownerUserId === userId);
    if (existing) {
      throw new ValidationError('User already has a supplier profile');
    }

    // Create supplier
    const supplier = {
      id: this.uid('sup'),
      ownerUserId: userId,
      name: String(data.name).trim(),
      category: data.category,
      description: data.description ? String(data.description).trim() : '',
      location: data.location || '',
      postcode: data.postcode || '',
      phone: data.phone || '',
      email: data.email || '',
      website: data.website || '',
      socials: data.socials || {},
      logo: data.logo || '',
      coverImage: data.coverImage || '',
      images: data.images || [],
      isPro: false,
      proExpiresAt: null,
      rating: 0,
      reviewCount: 0,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    suppliers.push(supplier);
    await this.db.write('suppliers', suppliers);

    logger.info(`Supplier created: ${supplier.id} by user ${userId}`);

    return supplier;
  }

  /**
   * Get supplier by ID
   * @param {string} id - Supplier ID
   * @returns {Promise<Object>} - Supplier data
   */
  async getSupplierById(id) {
    const suppliers = await this.db.read('suppliers');
    const supplier = suppliers.find(s => s.id === id);

    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Get packages
    const packages = await this.db.read('packages');
    const supplierPackages = packages.filter(p => p.supplierId === id);

    // Get reviews
    const reviews = await this.db.read('reviews');
    const supplierReviews = reviews.filter(r => r.supplierId === id);

    return {
      ...supplier,
      packages: supplierPackages,
      reviews: supplierReviews,
      packageCount: supplierPackages.length,
      reviewCount: supplierReviews.length,
    };
  }

  /**
   * Get supplier by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Supplier data
   */
  async getSupplierByUserId(userId) {
    const suppliers = await this.db.read('suppliers');
    const supplier = suppliers.find(s => s.ownerUserId === userId);

    if (!supplier) {
      throw new NotFoundError('Supplier profile not found');
    }

    return this.getSupplierById(supplier.id);
  }

  /**
   * Update supplier profile
   * @param {string} id - Supplier ID
   * @param {Object} updates - Profile updates
   * @param {string} userId - User ID making the update
   * @param {string} userRole - User role
   * @returns {Promise<Object>} - Updated supplier
   */
  async updateSupplier(id, updates, userId, userRole) {
    const suppliers = await this.db.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.id === id);

    if (supplierIndex === -1) {
      throw new NotFoundError('Supplier not found');
    }

    const supplier = suppliers[supplierIndex];

    // Authorization check
    if (userRole !== 'admin' && supplier.ownerUserId !== userId) {
      throw new AuthorizationError('You do not have permission to update this supplier');
    }

    // Allowed fields
    const allowedFields = [
      'name',
      'description',
      'category',
      'location',
      'postcode',
      'phone',
      'email',
      'website',
      'socials',
      'logo',
      'coverImage',
      'images',
    ];

    // Admins can update these fields
    if (userRole === 'admin') {
      allowedFields.push('isPro', 'proExpiresAt', 'verified');
    }

    // Apply updates
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        supplier[field] = updates[field];
      }
    });

    supplier.updatedAt = new Date().toISOString();

    suppliers[supplierIndex] = supplier;
    await this.db.write('suppliers', suppliers);

    logger.info(`Supplier updated: ${id} by user ${userId}`);

    return supplier;
  }

  /**
   * Delete supplier profile
   * @param {string} id - Supplier ID
   * @param {string} userId - User ID deleting the profile
   * @param {string} userRole - User role
   * @returns {Promise<void>}
   */
  async deleteSupplier(id, userId, userRole) {
    const suppliers = await this.db.read('suppliers');
    const supplier = suppliers.find(s => s.id === id);

    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Authorization check
    if (userRole !== 'admin' && supplier.ownerUserId !== userId) {
      throw new AuthorizationError('You do not have permission to delete this supplier');
    }

    // Remove supplier
    const filtered = suppliers.filter(s => s.id !== id);
    await this.db.write('suppliers', filtered);

    logger.info(`Supplier deleted: ${id} by user ${userId}`);
  }

  /**
   * Search suppliers with filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} - Search results
   */
  async searchSuppliers(filters = {}) {
    let suppliers = await this.db.read('suppliers');

    // Apply filters
    if (filters.name) {
      const searchTerm = filters.name.toLowerCase();
      suppliers = suppliers.filter(
        s =>
          s.name.toLowerCase().includes(searchTerm) ||
          (s.description && s.description.toLowerCase().includes(searchTerm))
      );
    }

    if (filters.category) {
      suppliers = suppliers.filter(s => s.category === filters.category);
    }

    if (filters.location) {
      const locationTerm = filters.location.toLowerCase();
      suppliers = suppliers.filter(
        s => s.location && s.location.toLowerCase().includes(locationTerm)
      );
    }

    if (filters.isPro !== undefined) {
      suppliers = suppliers.filter(s => s.isPro === filters.isPro);
    }

    if (filters.verified !== undefined) {
      suppliers = suppliers.filter(s => s.verified === filters.verified);
    }

    // Sort
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    suppliers.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) {
        return -sortOrder;
      }
      if (aVal > bVal) {
        return sortOrder;
      }
      return 0;
    });

    // Pagination
    const { skip, limit, page } = paginationHelper(filters.page, filters.limit);
    const total = suppliers.length;
    const paginatedSuppliers = suppliers.slice(skip, skip + limit);

    return {
      suppliers: paginatedSuppliers,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    };
  }

  /**
   * Check if supplier has active Pro subscription
   * @param {string} id - Supplier ID
   * @returns {Promise<boolean>} - True if Pro is active
   */
  async isProActive(id) {
    const suppliers = await this.db.read('suppliers');
    const supplier = suppliers.find(s => s.id === id);

    if (!supplier) {
      return false;
    }

    if (!supplier.isPro) {
      return false;
    }

    if (supplier.proExpiresAt) {
      const expiresAt = new Date(supplier.proExpiresAt);
      if (expiresAt < new Date()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update supplier Pro status
   * @param {string} id - Supplier ID
   * @param {boolean} isPro - Pro status
   * @param {string} expiresAt - Pro expiration date (ISO string)
   * @returns {Promise<Object>} - Updated supplier
   */
  async updateProStatus(id, isPro, expiresAt = null) {
    const suppliers = await this.db.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.id === id);

    if (supplierIndex === -1) {
      throw new NotFoundError('Supplier not found');
    }

    const supplier = suppliers[supplierIndex];
    supplier.isPro = isPro;
    supplier.proExpiresAt = expiresAt;
    supplier.updatedAt = new Date().toISOString();

    suppliers[supplierIndex] = supplier;
    await this.db.write('suppliers', suppliers);

    logger.info(`Supplier Pro status updated: ${id} - isPro: ${isPro}`);

    return supplier;
  }

  /**
   * Get featured suppliers
   * @param {number} limit - Number of suppliers to return
   * @returns {Promise<Array>} - Featured suppliers
   */
  async getFeaturedSuppliers(limit = 10) {
    let suppliers = await this.db.read('suppliers');

    // Get reviews for rating calculation
    const reviews = await this.db.read('reviews');

    // Add rating info
    suppliers = suppliers.map(supplier => {
      const supplierReviews = reviews.filter(r => r.supplierId === supplier.id);
      const averageRating =
        supplierReviews.length > 0
          ? supplierReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / supplierReviews.length
          : 0;

      return {
        ...supplier,
        reviewCount: supplierReviews.length,
        averageRating,
      };
    });

    // Sort: Pro first, then by rating
    suppliers.sort((a, b) => {
      if (a.isPro !== b.isPro) {
        return b.isPro ? 1 : -1;
      }
      if (a.averageRating !== b.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return b.reviewCount - a.reviewCount;
    });

    return suppliers.slice(0, limit);
  }
}

module.exports = SupplierService;
