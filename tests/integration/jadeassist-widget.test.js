/**
 * Integration tests for JadeAssist widget pinning
 * Ensures all HTML files use an immutable commit SHA instead of @main
 * This prevents CDN caching issues with moving references
 */

const path = require('path');
const fs = require('fs');

// Helper function to recursively find all HTML files
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

describe('JadeAssist Widget Pinning', () => {
  const publicDir = path.join(__dirname, '../../public');

  describe('Widget Script URLs', () => {
    it('should not reference @main in any HTML files', () => {
      // Find all HTML files in public directory
      const htmlFiles = findHtmlFiles(publicDir);

      const filesWithMain = [];
      for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for @main reference in JadeAssist URL
        if (content.includes('cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@main')) {
          filesWithMain.push(path.relative(publicDir, filePath));
        }
      }

      expect(filesWithMain).toEqual([]);
    });

    it('should use pinned commit SHA in widget script tags', () => {
      // Find all HTML files that include JadeAssist
      const htmlFiles = findHtmlFiles(publicDir);

      const expectedCommitSHA = 'b346f7e4d9130a4c258e987f955e2d0c3149e9b2';
      const filesWithWidget = [];
      const filesWithCorrectSHA = [];

      for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@')) {
          const relativePath = path.relative(publicDir, filePath);
          filesWithWidget.push(relativePath);

          if (content.includes(`JadeAssist@${expectedCommitSHA}`)) {
            filesWithCorrectSHA.push(relativePath);
          }
        }
      }

      // All files with widget should use the pinned SHA
      expect(filesWithCorrectSHA.length).toBe(filesWithWidget.length);
      expect(filesWithWidget.length).toBeGreaterThan(0);
    });

    it('should use correct widget file path', () => {
      const htmlFiles = findHtmlFiles(publicDir);

      const expectedPath = '/packages/widget/dist/jade-widget.js';
      const filesWithIncorrectPath = [];

      for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');

        // If file has JadeAssist reference, verify the path
        if (content.includes('cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@')) {
          if (!content.includes(expectedPath)) {
            filesWithIncorrectPath.push(path.relative(publicDir, filePath));
          }
        }
      }

      expect(filesWithIncorrectPath).toEqual([]);
    });
  });

  describe('Widget Initialization', () => {
    it('should have jadeassist-init.v2.js for widget configuration', () => {
      const initPath = path.join(publicDir, 'assets/js/jadeassist-init.v2.js');
      expect(fs.existsSync(initPath)).toBe(true);
    });

    it('should have legacy jadeassist-init.js for backwards compatibility', () => {
      const initPath = path.join(publicDir, 'assets/js/jadeassist-init.js');
      expect(fs.existsSync(initPath)).toBe(true);
    });

    it('should reference versioned init script in HTML files', () => {
      const htmlFiles = findHtmlFiles(publicDir);
      const filesWithVersionedInit = [];
      const filesWithOldInit = [];

      for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('/assets/js/jadeassist-init.v2.js')) {
          filesWithVersionedInit.push(path.relative(publicDir, filePath));
        }
        if (content.includes('/assets/js/jadeassist-init.js"')) {
          filesWithOldInit.push(path.relative(publicDir, filePath));
        }
      }

      // All HTML files with JadeAssist should use the versioned init script
      expect(filesWithOldInit).toEqual([]);
      expect(filesWithVersionedInit.length).toBeGreaterThan(0);
    });
  });
});
