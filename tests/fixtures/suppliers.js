/**
 * Supplier test fixtures
 * Provides sample supplier data for integration tests
 */

module.exports = {
  validSupplier: {
    name: 'Elite Photography',
    category: 'Photography',
    location: 'New York, NY',
    price_display: '$$',
    description_short: 'Professional event photography',
    description_long: 'We provide professional photography services for all types of events',
    amenities: ['WiFi', 'Parking', 'Equipment'],
    maxGuests: 200,
  },

  validVenue: {
    name: 'Grand Event Hall',
    category: 'Venue',
    location: 'Los Angeles, CA',
    price_display: '$$$',
    description_short: 'Elegant event space',
    description_long: 'Beautiful event hall with modern amenities',
    amenities: ['WiFi', 'Parking', 'Catering', 'Sound System'],
    maxGuests: 500,
  },

  // Generate unique supplier
  generateSupplier: (suffix = Date.now()) => ({
    name: `Test Supplier ${suffix}`,
    category: 'Photography',
    location: 'Test City, ST',
    price_display: '$$',
    description_short: `Test supplier ${suffix}`,
    description_long: `Test supplier description ${suffix}`,
    amenities: ['WiFi', 'Parking'],
    maxGuests: 100,
  }),

  updateData: {
    name: 'Updated Supplier Name',
    description_short: 'Updated description',
    price_display: '$$$',
  },
};
