/**
 * Supplier Service
 * Handles supplier management and business logic
 */

'use strict';

const { NotFoundError, ValidationError, AuthorizationError } = require('../errors');
const logger = require('../utils/logger');
const { paginationHelper } = require('../utils/database');

/**
 * Generate SEO-friendly slug from text
 * @param {string} text - Text to slugify
 * @returns {string} - URL-safe slug
 */
function generateSlug(text) {
  if (!text) {
    return '';
  }
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

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

      // Publishing workflow (Phase 1 additions)
      status: data.status || 'draft',
      slug: data.slug || generateSlug(String(data.name).trim()),
      publishedAt: data.publishedAt || null,

      // SEO & Social
      metaDescription: data.metaDescription || '',
      openGraphImage: data.openGraphImage || '',
      tags: Array.isArray(data.tags) ? data.tags : [],

      // Business details
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      priceRange: data.priceRange || '£',
      businessHours: data.businessHours || {},
      responseTime: data.responseTime || null,

      // Media & Content
      bookingUrl: data.bookingUrl || '',
      videoUrl: data.videoUrl || '',
      faqs: Array.isArray(data.faqs) ? data.faqs : [],
      testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
      awards: Array.isArray(data.awards) ? data.awards : [],
      certifications: Array.isArray(data.certifications) ? data.certifications : [],

      // Analytics (denormalized)
      viewCount: data.viewCount || 0,
      enquiryCount: data.enquiryCount || 0,

      // Admin approval
      approvedAt: data.approvedAt || null,
      approvedBy: data.approvedBy || null,
    };

    suppliers.push(supplier);
    await this.db.insertOne('suppliers', supplier);

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
    const supplier = await this.db.findOne('suppliers', { id });

    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

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
      // Phase 1 additions - Supplier can update
      'status',
      'slug',
      'metaDescription',
      'openGraphImage',
      'tags',
      'amenities',
      'priceRange',
      'businessHours',
      'bookingUrl',
      'videoUrl',
      'faqs',
      'testimonials',
      'awards',
      'certifications',
    ];

    // Admins can update these fields
    if (userRole === 'admin') {
      allowedFields.push(
        'isPro',
        'proExpiresAt',
        'verified',
        'publishedAt',
        'approvedAt',
        'approvedBy',
        'responseTime',
        'viewCount',
        'enquiryCount'
      );
    }

    // Apply updates
    const setFields = { updatedAt: new Date().toISOString() };
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        setFields[field] = updates[field];
      }
    });

    await this.db.updateOne('suppliers', { id }, { $set: setFields });

    logger.info(`Supplier updated: ${id} by user ${userId}`);

    return { ...supplier, ...setFields };
  }

  /**
   * Delete supplier profile
   * @param {string} id - Supplier ID
   * @param {string} userId - User ID deleting the profile
   * @param {string} userRole - User role
   * @returns {Promise<void>}
   */
  async deleteSupplier(id, userId, userRole) {
    const supplier = await this.db.findOne('suppliers', { id });

    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Authorization check
    if (userRole !== 'admin' && supplier.ownerUserId !== userId) {
      throw new AuthorizationError('You do not have permission to delete this supplier');
    }

    // Remove supplier
    await this.db.deleteOne('suppliers', id);

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
    const supplier = await this.db.findOne('suppliers', { id });

    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const setFields = {
      isPro,
      proExpiresAt: expiresAt,
      updatedAt: new Date().toISOString(),
    };
    await this.db.updateOne('suppliers', { id }, { $set: setFields });

    logger.info(`Supplier Pro status updated: ${id} - isPro: ${isPro}`);

    return { ...supplier, ...setFields };
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
module.exports.generateSlug = generateSlug;
