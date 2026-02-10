/**
 * Package test fixtures
 * Provides sample package data for integration tests
 */

module.exports = {
  validPackage: {
    title: 'Test Wedding Package',
    description: 'Complete wedding photography package with 8 hours coverage',
    price: '$2,500',
    category: 'Photography',
  },

  validPackageWithDetails: {
    title: 'Premium Event Package',
    description: 'Premium event services with full coordination',
    price: '$5,000',
    category: 'Event Planning',
    features: ['Full coordination', '10 hour coverage', 'Premium equipment'],
    maxGuests: 200,
  },

  invalidPackage: {
    title: '',
    description: '',
    price: '',
  },

  // Generate unique package
  generatePackage: (suffix = Date.now()) => ({
    title: `Test Package ${suffix}`,
    description: `Test package description ${suffix}`,
    price: `$${Math.floor(Math.random() * 5000) + 500}`,
    category: 'Photography',
  }),

  updateData: {
    title: 'Updated Package Title',
    description: 'Updated package description',
    price: '$3,000',
  },
};
