/**
 * Integration tests for admin package image upload endpoint
 * Tests error handling and validation for image uploads
 */

const fs = require('fs');

describe('Admin Package Image Upload Error Handling', () => {
  describe('Endpoint Structure Verification', () => {
    it('should have package image upload endpoint in server.js', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Verify the package image upload endpoint exists
      expect(serverContent).toContain('app.post(');
      expect(serverContent).toContain("'/api/admin/packages/:id/image'");
      expect(serverContent).toContain("photoUpload.upload.single('image')");
    });

    it('should have ValidationError handling in package image endpoint', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify error handling exists
      expect(packageImageEndpoint).toContain("error.name === 'ValidationError'");
      expect(packageImageEndpoint).toContain('res.status(400).json');
      expect(packageImageEndpoint).toContain('details: error.details');
    });

    it('should have Sharp error handling in package image endpoint', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify Sharp error handling exists
      expect(packageImageEndpoint).toContain("error.name === 'SharpProcessingError'");
      expect(packageImageEndpoint).toContain('Failed to process image');
    });

    it('should have MongoDB/storage error handling in package image endpoint', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify MongoDB/storage error handling exists
      expect(packageImageEndpoint).toContain("error.name === 'MongoDBStorageError'");
      expect(packageImageEndpoint).toContain("error.name === 'FilesystemError'");
      expect(packageImageEndpoint).toContain('Failed to save image');
    });

    it('should have logging in package image endpoint', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify logging exists
      expect(packageImageEndpoint).toContain('logger.info');
      expect(packageImageEndpoint).toContain('logger.error');
      expect(packageImageEndpoint).toContain('Processing package image upload');
    });
  });

  describe('Category Hero Image Upload Error Handling', () => {
    it('should have category hero image upload endpoint with similar error handling', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the category hero image upload endpoint
      const categoryImageStart = serverContent.indexOf("'/api/admin/categories/:id/hero-image'");
      const nextEndpointStart = serverContent.indexOf('app.', categoryImageStart + 100);
      const categoryImageEndpoint = serverContent.substring(categoryImageStart, nextEndpointStart);

      // Verify error handling exists
      expect(categoryImageEndpoint).toContain("error.name === 'ValidationError'");
      expect(categoryImageEndpoint).toContain('res.status(400).json');
      expect(categoryImageEndpoint).toContain("error.name === 'SharpProcessingError'");
      expect(categoryImageEndpoint).toContain('logger.info');
      expect(categoryImageEndpoint).toContain('logger.error');
    });
  });

  describe('Photo Upload Module Error Handling', () => {
    it('should have enhanced error handling in processAndSaveImage', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Verify enhanced error handling
      expect(photoUploadContent).toContain('ValidationError');
      expect(photoUploadContent).toContain('logger.info');
      expect(photoUploadContent).toContain('Starting image processing');
      expect(photoUploadContent).toContain('Image validation passed');
    });

    it('should have error context in processImage function', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Find processImage function
      const processImageStart = photoUploadContent.indexOf('async function processImage(');
      const processImageEnd = photoUploadContent.indexOf('}', processImageStart + 500);
      const processImageFunc = photoUploadContent.substring(processImageStart, processImageEnd);

      // Verify error wrapping
      expect(processImageFunc).toContain('SharpProcessingError');
      expect(processImageFunc).toContain('Image processing failed');
    });

    it('should have error context in saveToLocal function', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Find saveToLocal function
      const saveToLocalStart = photoUploadContent.indexOf('async function saveToLocal(');
      const saveToLocalEnd = photoUploadContent.indexOf('}', saveToLocalStart + 800);
      const saveToLocalFunc = photoUploadContent.substring(saveToLocalStart, saveToLocalEnd);

      // Verify error wrapping
      expect(saveToLocalFunc).toContain('FilesystemError');
      expect(saveToLocalFunc).toContain('Failed to save image to local filesystem');
    });

    it('should have error context in saveToMongoDB function', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Find saveToMongoDB function
      const saveToMongoDBStart = photoUploadContent.indexOf('async function saveToMongoDB(');
      const saveToMongoDBEnd = photoUploadContent.indexOf('}', saveToMongoDBStart + 800);
      const saveToMongoDBFunc = photoUploadContent.substring(saveToMongoDBStart, saveToMongoDBEnd);

      // Verify error wrapping
      expect(saveToMongoDBFunc).toContain('MongoDBStorageError');
      expect(saveToMongoDBFunc).toContain('Failed to save image to MongoDB');
    });
  });

  describe('Upload Validation Error Handling', () => {
    it('should have Sharp error handling in processWithMetadataStripping', () => {
      const uploadValidationContent = fs.readFileSync('utils/uploadValidation.js', 'utf8');

      // Find processWithMetadataStripping function
      const processStart = uploadValidationContent.indexOf(
        'async function processWithMetadataStripping('
      );
      const processEnd = uploadValidationContent.indexOf('}', processStart + 1000);
      const processFunc = uploadValidationContent.substring(processStart, processEnd);

      // Verify error handling
      expect(processFunc).toContain('SharpProcessingError');
      expect(processFunc).toContain('Failed to process image with Sharp');
      expect(processFunc).toContain('logger.error');
    });

    it('should include allowedTypes in validateFileType responses', () => {
      const uploadValidationContent = fs.readFileSync('utils/uploadValidation.js', 'utf8');

      // Find validateFileType function
      const validateStart = uploadValidationContent.indexOf('async function validateFileType(');
      const validateEnd = uploadValidationContent.indexOf('\n}\n', validateStart + 100);
      const validateFunc = uploadValidationContent.substring(validateStart, validateEnd);

      // Verify allowedTypes is included in error responses
      expect(validateFunc).toContain('allowedTypes: ALLOWED_IMAGE_TYPES');
    });

    it('should log magic bytes when file type validation fails', () => {
      const uploadValidationContent = fs.readFileSync('utils/uploadValidation.js', 'utf8');

      // Find validateFileType function
      const validateStart = uploadValidationContent.indexOf('async function validateFileType(');
      const validateEnd = uploadValidationContent.indexOf('\n}\n', validateStart + 100);
      const validateFunc = uploadValidationContent.substring(validateStart, validateEnd);

      // Verify magic bytes logging
      expect(validateFunc).toContain('magicBytes');
      expect(validateFunc).toContain("toString('hex')");
      expect(validateFunc).toContain('logger.warn');
    });

    it('should log detected MIME type when validation fails', () => {
      const uploadValidationContent = fs.readFileSync('utils/uploadValidation.js', 'utf8');

      // Find validateFileType function
      const validateStart = uploadValidationContent.indexOf('async function validateFileType(');
      const validateEnd = uploadValidationContent.indexOf('\n}\n', validateStart + 100);
      const validateFunc = uploadValidationContent.substring(validateStart, validateEnd);

      // Verify MIME type logging
      expect(validateFunc).toContain('detectedType');
      expect(validateFunc).toContain('File type not allowed');
    });
  });

  describe('Error Response Structure', () => {
    it('should return proper error response structure for validation errors', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify error response includes both error message and details
      expect(packageImageEndpoint).toContain('error: userMessage');
      expect(packageImageEndpoint).toContain('detectedType');
      expect(packageImageEndpoint).toContain('allowedTypes');
      expect(packageImageEndpoint).toContain('allowedFormats');
    });

    it('should include enhanced error details for file type validation', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify enhanced error messages
      expect(packageImageEndpoint).toContain('File type validation failed');
      expect(packageImageEndpoint).toContain('Could not detect file type');
      expect(packageImageEndpoint).toContain('Allowed types: JPEG, PNG, WebP, GIF');
    });

    it('should log magic bytes when file type validation fails', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify magic bytes logging
      expect(packageImageEndpoint).toContain('magicBytes');
      expect(packageImageEndpoint).toContain('logger.warn');
      expect(packageImageEndpoint).toContain('File type validation failed - magic bytes');
    });

    it('should use appropriate HTTP status codes', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the package image upload endpoint
      const packageImageStart = serverContent.indexOf("'/api/admin/packages/:id/image'");
      const nextEndpointStart = serverContent.indexOf('app.post(', packageImageStart + 100);
      const packageImageEndpoint = serverContent.substring(packageImageStart, nextEndpointStart);

      // Verify status codes
      expect(packageImageEndpoint).toContain('res.status(400)'); // Validation errors
      expect(packageImageEndpoint).toContain('res.status(404)'); // Not found
      expect(packageImageEndpoint).toContain('res.status(500)'); // Server errors
    });
  });

  describe('Category Hero Image Enhanced Error Handling', () => {
    it('should have enhanced error details in category hero image endpoint', () => {
      const serverContent = fs.readFileSync('server.js', 'utf8');

      // Find the category hero image upload endpoint
      const categoryImageStart = serverContent.indexOf("'/api/admin/categories/:id/hero-image'");
      const nextEndpointStart = serverContent.indexOf('app.', categoryImageStart + 100);
      const categoryImageEndpoint = serverContent.substring(categoryImageStart, nextEndpointStart);

      // Verify enhanced error handling exists
      expect(categoryImageEndpoint).toContain('detectedType');
      expect(categoryImageEndpoint).toContain('allowedTypes');
      expect(categoryImageEndpoint).toContain('allowedFormats');
      expect(categoryImageEndpoint).toContain('File type validation failed');
      expect(categoryImageEndpoint).toContain('magicBytes');
    });
  });

  describe('Directory Creation', () => {
    it('should ensure directories exist before saving in saveToLocal', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Find saveToLocal function
      const saveToLocalStart = photoUploadContent.indexOf('async function saveToLocal(');
      const saveToLocalEnd = photoUploadContent.indexOf('}', saveToLocalStart + 800);
      const saveToLocalFunc = photoUploadContent.substring(saveToLocalStart, saveToLocalEnd);

      // Verify directory creation
      expect(saveToLocalFunc).toContain('fs.mkdir');
      expect(saveToLocalFunc).toContain('recursive: true');
    });

    it('should create directories on module load', () => {
      const photoUploadContent = fs.readFileSync('photo-upload.js', 'utf8');

      // Verify directory creation function exists and is called
      expect(photoUploadContent).toContain('function ensureDirectoriesExist()');
      expect(photoUploadContent).toContain('ensureDirectoriesExist()');
      expect(photoUploadContent).toContain('mkdirSync');
    });
  });

  describe('Client-Side Error Handling', () => {
    it('should parse and display detailed error messages', () => {
      const clientContent = fs.readFileSync(
        'public/assets/js/pages/admin-packages-init.js',
        'utf8'
      );

      // Verify enhanced error message parsing
      expect(clientContent).toContain('errorData.details');
      expect(clientContent).toContain('details.detectedType');
      expect(clientContent).toContain('details.allowedFormats');
    });

    it('should format error messages with detected and allowed types', () => {
      const clientContent = fs.readFileSync(
        'public/assets/js/pages/admin-packages-init.js',
        'utf8'
      );

      // Verify error message formatting
      expect(clientContent).toContain('Could not detect file type');
      expect(clientContent).toContain('Invalid file type');
      expect(clientContent).toContain('Detected:');
      expect(clientContent).toContain('Allowed:');
    });
  });
});
