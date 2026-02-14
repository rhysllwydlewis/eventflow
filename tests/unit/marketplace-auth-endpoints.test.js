const fs = require('fs');
const path = require('path');

describe('Marketplace auth endpoint usage', () => {
  const files = [
    'public/assets/js/my-marketplace-listings.js',
    'public/assets/js/marketplace-new-listing.js',
  ];

  for (const file of files) {
    it(`${file} should use /api/v1/auth/me and not legacy /api/v1/user`, () => {
      const fullPath = path.join(process.cwd(), file);
      const content = fs.readFileSync(fullPath, 'utf8');

      expect(content).toContain('/api/v1/auth/me');
      expect(content).not.toContain('/api/v1/user');
    });
  }
});
