const fs = require('fs');
const path = require('path');

describe('Marketplace new listing image upload flow', () => {
  const filePath = path.join(process.cwd(), 'public/assets/js/marketplace-new-listing.js');
  const content = fs.readFileSync(filePath, 'utf8');

  it('uses batch photo upload endpoint for marketplace images', () => {
    expect(content).toContain('/api/v1/photos/upload/batch?type=marketplace&id=${listingId}');
    expect(content).toContain("formData.append('photos', img.file)");
  });

  it('includes existing image URLs in listing update payload', () => {
    expect(content).toContain('images: selectedImages.filter(img => !img.new).map(img => img.url)');
  });
});
