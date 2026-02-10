/**
 * Mock data generators
 * Generate random test data for integration tests
 */

/**
 * Generate mock user
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock user data
 */
function generateMockUser(overrides = {}) {
  const id = Math.floor(Math.random() * 100000);
  return {
    email: `user${id}@example.com`,
    password: 'TestPassword123!',
    username: `user${id}`,
    name: `Test User ${id}`,
    ...overrides,
  };
}

/**
 * Generate mock supplier
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock supplier data
 */
function generateMockSupplier(overrides = {}) {
  const id = Math.floor(Math.random() * 100000);
  const categories = ['Photography', 'Catering', 'Venue', 'DJ', 'Florist'];
  const locations = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX'];

  return {
    name: `Mock Supplier ${id}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    location: locations[Math.floor(Math.random() * locations.length)],
    price_display: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)],
    description_short: `Mock supplier ${id}`,
    description_long: `Detailed description for mock supplier ${id}`,
    amenities: ['WiFi', 'Parking'],
    maxGuests: Math.floor(Math.random() * 400) + 50,
    ...overrides,
  };
}

/**
 * Generate mock package
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock package data
 */
function generateMockPackage(overrides = {}) {
  const id = Math.floor(Math.random() * 100000);
  return {
    title: `Mock Package ${id}`,
    description: `Description for mock package ${id}`,
    price: `$${Math.floor(Math.random() * 5000) + 500}`,
    category: 'Photography',
    ...overrides,
  };
}

/**
 * Generate mock review
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock review data
 */
function generateMockReview(overrides = {}) {
  const comments = [
    'Excellent service!',
    'Great experience, highly recommend',
    'Professional and reliable',
    'Outstanding quality',
  ];

  return {
    rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
    comment: comments[Math.floor(Math.random() * comments.length)],
    eventType: 'Wedding',
    eventDate: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

/**
 * Generate mock message
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock message data
 */
function generateMockMessage(overrides = {}) {
  return {
    content: `Test message content ${Math.random().toString(36).substring(7)}`,
    recipientId: `user_${Math.floor(Math.random() * 1000)}`,
    ...overrides,
  };
}

/**
 * Generate mock event details for AI
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock event details
 */
function generateMockEventDetails(overrides = {}) {
  return {
    eventType: 'Wedding',
    eventDate: '2024-06-15',
    guestCount: 150,
    budget: 25000,
    location: 'New York, NY',
    preferences: 'Elegant, modern style',
    ...overrides,
  };
}

/**
 * Generate array of mock items
 * @param {Function} generator - Generator function
 * @param {number} count - Number of items to generate
 * @returns {Array} Array of mock items
 */
function generateMockArray(generator, count = 5) {
  return Array.from({ length: count }, () => generator());
}

module.exports = {
  generateMockUser,
  generateMockSupplier,
  generateMockPackage,
  generateMockReview,
  generateMockMessage,
  generateMockEventDetails,
  generateMockArray,
};
