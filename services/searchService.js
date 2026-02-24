/**
 * Advanced Search Service
 * Provides weighted full-text search, filtering, and ranking
 */

'use strict';

const dbUnified = require('../db-unified');
const {
  calculateRelevanceScore,
  getMatchingSnippets,
  getMatchingFields,
} = require('../utils/searchWeighting');

/**
 * Project safe public fields from supplier object
 * Excludes sensitive information like email, phone, addresses, etc.
 */
function projectPublicSupplierFields(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    category: supplier.category,
    location: supplier.location,
    description_short: supplier.description_short,
    description_long: supplier.description_long,
    logo: supplier.logo,
    images: supplier.images,
    price_display: supplier.price_display,
    startingPrice: supplier.startingPrice,
    rating: supplier.rating || supplier.averageRating, // Legacy field for backward compatibility
    averageRating: supplier.averageRating,
    reviewCount: supplier.reviewCount,
    verified: supplier.verified,
    isPro: supplier.isPro,
    featured: supplier.featured,
    featuredSupplier: supplier.featuredSupplier,
    approved: supplier.approved,
    amenities: supplier.amenities,
    maxGuests: supplier.maxGuests,
    badges: supplier.badges,
    verifications: supplier.verifications,
    subscriptionTier: supplier.subscriptionTier,
    isFounding: supplier.isFounding,
    isTest: supplier.isTest,
    // Explicitly exclude: email, phone, address, businessAddress, owner details, etc.
  };
}

/**
 * Project safe public fields from package object
 */
function projectPublicPackageFields(pkg) {
  return {
    id: pkg.id,
    title: pkg.title,
    description: pkg.description,
    description_short: pkg.description_short,
    category: pkg.category,
    price: pkg.price,
    images: pkg.images,
    supplierId: pkg.supplierId,
    supplierName: pkg.supplierName,
    location: pkg.location,
    maxGuests: pkg.maxGuests,
    features: pkg.features,
    approved: pkg.approved,
    createdAt: pkg.createdAt,
    // Explicitly exclude: internal flags, seller contact info, etc.
  };
}

/**
 * Search suppliers with weighted relevance scoring
 * @param {Object} query - Search parameters
 * @param {string} [query.q] - Search query text (max 200 chars)
 * @param {string} [query.category] - Filter by category
 * @param {string} [query.location] - Filter by location (partial match)
 * @param {number} [query.minPrice] - Minimum price level (1-4)
 * @param {number} [query.maxPrice] - Maximum price level (1-4)
 * @param {number} [query.minRating] - Minimum average rating (0-5)
 * @param {string|Array<string>} [query.amenities] - Required amenities
 * @param {number} [query.minGuests] - Minimum guest capacity
 * @param {boolean|string} [query.proOnly] - Filter to pro suppliers only
 * @param {boolean|string} [query.featuredOnly] - Filter to featured only
 * @param {boolean|string} [query.verifiedOnly] - Filter to verified only
 * @param {string} [query.sortBy='relevance'] - Sort order: relevance, rating, reviews, name, newest, priceAsc, priceDesc
 * @param {number} [query.page=1] - Page number (1-indexed)
 * @param {number} [query.limit=20] - Results per page (max 100)
 * @returns {Promise<Object>} Search results with scores
 * @returns {Promise<Object>} result - Search results object
 * @returns {Array<Object>} result.results - Array of suppliers with relevance scores and match info
 * @returns {Object} result.pagination - Pagination metadata (total, page, limit, pages)
 * @returns {Object} result.facets - Faceted search data (categories, ratings, priceRanges, amenities)
 * @returns {number} result.durationMs - Search execution time in milliseconds
 */
async function searchSuppliers(query) {
  const startTime = Date.now();
  const suppliers = await dbUnified.read('suppliers');

  // Filter approved suppliers
  let results = suppliers.filter(s => s.approved);

  // Apply filters
  results = applyFilters(results, query);

  // Calculate relevance scores if query present
  if (query.q) {
    results = results.map(supplier => {
      const score = calculateRelevanceScore(supplier, query.q, query);
      const matchedFields = getMatchingFields(supplier, query.q);
      const snippets = getMatchingSnippets(
        [
          supplier.name || '',
          supplier.description_short || '',
          supplier.description_long || '',
        ].join(' '),
        query.q
      );

      // Project only public fields
      const publicSupplier = projectPublicSupplierFields(supplier);

      return {
        ...publicSupplier,
        relevanceScore: score,
        match: {
          fields: matchedFields,
          snippets,
        },
      };
    });

    // Filter out items with zero score
    results = results.filter(r => r.relevanceScore > 0);
  } else {
    // No search query, just project public fields
    results = results.map(projectPublicSupplierFields);
  }

  // Sort results
  results = sortResults(results, query.sortBy || 'relevance');

  // Get total before pagination
  const total = results.length;

  // Pagination
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const skip = (page - 1) * limit;
  results = results.slice(skip, skip + limit);

  // Calculate facets
  const allResults = await dbUnified.read('suppliers');
  const facets = calculateFacets(
    allResults.filter(s => s.approved),
    query
  );

  const duration = Date.now() - startTime;

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    facets,
    durationMs: duration,
  };
}

/**
 * Search packages across all suppliers
 * @param {Object} query - Search parameters
 * @returns {Promise<Object>} Search results
 */
async function searchPackages(query) {
  const startTime = Date.now();
  const packages = await dbUnified.read('packages');
  const suppliers = await dbUnified.read('suppliers');

  // Create a supplier lookup map
  const supplierMap = {};
  suppliers.forEach(s => {
    supplierMap[s.id] = s;
  });

  // Filter approved packages from approved suppliers
  let results = packages.filter(p => {
    const supplier = supplierMap[p.supplierId];
    return p.approved && supplier && supplier.approved;
  });

  // Apply filters
  results = applyPackageFilters(results, query, supplierMap);

  // Calculate relevance scores
  if (query.q) {
    results = results.map(pkg => {
      const supplier = supplierMap[pkg.supplierId];
      const score = calculateRelevanceScore(pkg, query.q, query);
      const matchedFields = getMatchingFields(pkg, query.q);
      const snippets = getMatchingSnippets(
        [pkg.title || '', pkg.description || ''].join(' '),
        query.q
      );

      // Project only public fields for package
      const publicPkg = projectPublicPackageFields(pkg);

      return {
        ...publicPkg,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              logo: supplier.logo,
              location: supplier.location,
              averageRating: supplier.averageRating,
              verified: supplier.verified,
            }
          : null,
        relevanceScore: score,
        match: {
          fields: matchedFields,
          snippets,
        },
      };
    });

    results = results.filter(r => r.relevanceScore > 0);
  } else {
    // Add supplier info even without scoring, project public fields
    results = results.map(pkg => {
      const supplier = supplierMap[pkg.supplierId];
      const publicPkg = projectPublicPackageFields(pkg);

      return {
        ...publicPkg,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              logo: supplier.logo,
              location: supplier.location,
              averageRating: supplier.averageRating,
              verified: supplier.verified,
            }
          : null,
      };
    });
  }

  // Sort results
  results = sortPackageResults(results, query.sortBy || 'relevance');

  const total = results.length;

  // Pagination
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const skip = (page - 1) * limit;
  results = results.slice(skip, skip + limit);

  const duration = Date.now() - startTime;

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    durationMs: duration,
  };
}

/**
 * Advanced search with complex criteria
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Object>} Search results
 */
async function advancedSearch(criteria) {
  const startTime = Date.now();

  // Determine search type
  const searchType = criteria.type || 'suppliers'; // 'suppliers' or 'packages'

  let results;
  if (searchType === 'packages') {
    results = await searchPackages(criteria);
  } else {
    results = await searchSuppliers(criteria);
  }

  results.durationMs = Date.now() - startTime;

  return results;
}

/**
 * Apply filters to supplier results
 * @param {Array} suppliers - Supplier array
 * @param {Object} query - Query parameters
 * @returns {Array} Filtered suppliers
 */
function applyFilters(suppliers, query) {
  let results = suppliers;

  // Text search (applied in scoring, but also filter out non-matches)
  if (query.q) {
    const searchTerm = query.q.toLowerCase();
    results = results.filter(s => {
      const searchableText = [
        s.name || '',
        s.description_short || '',
        s.description_long || '',
        s.category || '',
        s.location || '',
        ...(s.amenities || []),
        ...(s.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }

  // Category filter
  if (query.category) {
    results = results.filter(s => s.category === query.category);
  }

  // Location filter
  if (query.location) {
    const locationTerm = query.location.toLowerCase();
    results = results.filter(s => {
      const location = (s.location || '').toLowerCase();
      return location.includes(locationTerm);
    });
  }

  // Event type filter (matches category or tags)
  if (query.eventType) {
    const eventTypeTerm = query.eventType.toLowerCase();
    results = results.filter(s => {
      const category = (s.category || '').toLowerCase();
      const tags = (s.tags || []).map(t => t.toLowerCase());
      return category.includes(eventTypeTerm) || tags.some(t => t.includes(eventTypeTerm));
    });
  }

  // Price range filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    results = results.filter(s => {
      const priceDisplay = s.price_display || '';
      // Support both $ and £ price-level symbols
      const symbol = priceDisplay.includes('£') ? '£' : '$';
      const priceLevel = priceDisplay.split(symbol).length - 1;

      if (query.minPrice !== undefined && priceLevel < Number(query.minPrice)) {
        return false;
      }
      if (query.maxPrice !== undefined && priceLevel > Number(query.maxPrice)) {
        return false;
      }

      return true;
    });
  }

  // Rating filter
  if (query.minRating !== undefined) {
    const minRating = Number(query.minRating);
    results = results.filter(s => (s.averageRating || 0) >= minRating);
  }

  // Amenities filter
  if (query.amenities) {
    const requiredAmenities = Array.isArray(query.amenities)
      ? query.amenities
      : query.amenities.split(',').map(a => a.trim());

    results = results.filter(s => {
      const supplierAmenities = s.amenities || [];
      return requiredAmenities.every(amenity => supplierAmenities.includes(amenity));
    });
  }

  // Max guests filter
  if (query.minGuests !== undefined) {
    const minGuests = Number(query.minGuests);
    results = results.filter(s => !s.maxGuests || s.maxGuests >= minGuests);
  }

  // Boolean filters
  if (query.proOnly === 'true' || query.proOnly === true) {
    results = results.filter(s => s.isPro);
  }

  if (query.featuredOnly === 'true' || query.featuredOnly === true) {
    results = results.filter(s => s.featured);
  }

  if (query.verifiedOnly === 'true' || query.verifiedOnly === true) {
    results = results.filter(s => s.verified);
  }

  return results;
}

/**
 * Apply filters to package results
 * @param {Array} packages - Package array
 * @param {Object} query - Query parameters
 * @param {Object} supplierMap - Supplier lookup map
 * @returns {Array} Filtered packages
 */
function applyPackageFilters(packages, query, supplierMap) {
  let results = packages;

  // Text search
  if (query.q) {
    const searchTerm = query.q.toLowerCase();
    results = results.filter(p => {
      const searchableText = [
        p.title || '',
        p.description || '',
        supplierMap[p.supplierId]?.name || '',
        supplierMap[p.supplierId]?.category || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }

  // Category filter (from supplier)
  if (query.category) {
    results = results.filter(p => {
      const supplier = supplierMap[p.supplierId];
      return supplier && supplier.category === query.category;
    });
  }

  // Location filter (from supplier)
  if (query.location) {
    const locationTerm = query.location.toLowerCase();
    results = results.filter(p => {
      const supplier = supplierMap[p.supplierId];
      return supplier && (supplier.location || '').toLowerCase().includes(locationTerm);
    });
  }

  // Price range filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    results = results.filter(p => {
      const price = p.price || 0;

      if (query.minPrice !== undefined && price < Number(query.minPrice)) {
        return false;
      }
      if (query.maxPrice !== undefined && price > Number(query.maxPrice)) {
        return false;
      }

      return true;
    });
  }

  return results;
}

/**
 * Sort search results
 * @param {Array} results - Results to sort
 * @param {string} sortBy - Sort criteria
 * @returns {Array} Sorted results
 */
function sortResults(results, sortBy) {
  const sorted = [...results];

  switch (sortBy) {
    case 'relevance':
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
      });
      break;

    case 'rating':
      sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      break;

    case 'reviews':
      sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      break;

    case 'name':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;

    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;

    case 'priceAsc':
      sorted.sort((a, b) => {
        const dispA = a.price_display || '';
        const symA = dispA.includes('£') ? '£' : '$';
        const priceA = dispA.split(symA).length - 1;
        const dispB = b.price_display || '';
        const symB = dispB.includes('£') ? '£' : '$';
        const priceB = dispB.split(symB).length - 1;
        return priceA - priceB;
      });
      break;

    case 'priceDesc':
      sorted.sort((a, b) => {
        const dispA = a.price_display || '';
        const symA = dispA.includes('£') ? '£' : '$';
        const priceA = dispA.split(symA).length - 1;
        const dispB = b.price_display || '';
        const symB = dispB.includes('£') ? '£' : '$';
        const priceB = dispB.split(symB).length - 1;
        return priceB - priceA;
      });
      break;

    case 'distance':
      // Distance sort requires geolocation; fall back to relevance
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
      });
      break;

    default:
      // Default to relevance
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
      });
  }

  return sorted;
}

/**
 * Sort package results
 * @param {Array} results - Results to sort
 * @param {string} sortBy - Sort criteria
 * @returns {Array} Sorted results
 */
function sortPackageResults(results, sortBy) {
  const sorted = [...results];

  switch (sortBy) {
    case 'relevance':
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
      });
      break;

    case 'priceAsc':
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;

    case 'priceDesc':
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;

    case 'name':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;

    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;

    default:
      sorted.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
      });
  }

  return sorted;
}

/**
 * Calculate facets for filtering
 * @param {Array} allSuppliers - All suppliers
 * @returns {Object} Facets
 */
function calculateFacets(allSuppliers) {
  // Category facets
  const categoryCounts = {};
  allSuppliers.forEach(s => {
    if (s.category) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    }
  });

  const categories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Rating facets
  const ratingRanges = [
    { rating: '4.5+', min: 4.5, count: 0 },
    { rating: '4.0+', min: 4.0, count: 0 },
    { rating: '3.5+', min: 3.5, count: 0 },
    { rating: '3.0+', min: 3.0, count: 0 },
  ];

  allSuppliers.forEach(s => {
    const rating = s.averageRating || 0;
    ratingRanges.forEach(range => {
      if (rating >= range.min) {
        range.count++;
      }
    });
  });

  // Price range facets
  const priceRanges = [
    { label: '$', min: 0, max: 1, count: 0 },
    { label: '$$', min: 1, max: 2, count: 0 },
    { label: '$$$', min: 2, max: 3, count: 0 },
    { label: '$$$$', min: 3, max: 10, count: 0 },
  ];

  allSuppliers.forEach(s => {
    const priceDisplay = s.price_display || '';
    const symbol = priceDisplay.includes('£') ? '£' : '$';
    const priceLevel = priceDisplay.split(symbol).length - 1;
    priceRanges.forEach(range => {
      if (priceLevel >= range.min && priceLevel <= range.max) {
        range.count++;
      }
    });
  });

  // Amenities facets
  const amenityCounts = {};
  allSuppliers.forEach(s => {
    if (s.amenities && Array.isArray(s.amenities)) {
      s.amenities.forEach(amenity => {
        amenityCounts[amenity] = (amenityCounts[amenity] || 0) + 1;
      });
    }
  });

  const amenities = Object.entries(amenityCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    categories,
    ratings: ratingRanges,
    priceRanges,
    amenities,
  };
}

module.exports = {
  searchSuppliers,
  searchPackages,
  advancedSearch,
};
