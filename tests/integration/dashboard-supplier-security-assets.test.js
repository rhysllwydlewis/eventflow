const fs = require('fs');
const path = require('path');

describe('Dashboard supplier security-oriented script loading', () => {
  let dashboardContent;

  beforeAll(() => {
    dashboardContent = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'public', 'dashboard-supplier.html'),
      'utf8'
    );
  });

  it('uses local confetti script instead of jsdelivr CDN', () => {
    expect(dashboardContent).toContain('/assets/js/vendor/confetti-safe.js');
    expect(dashboardContent).not.toContain('canvas-confetti@1.9.2/dist/confetti.browser.min.js');
  });

  it('does not include JadeAssist third-party widget script on supplier dashboard', () => {
    expect(dashboardContent).not.toContain('packages/widget/dist/jade-widget.js');
    expect(dashboardContent).not.toContain('/assets/js/jadeassist-init.v2.js');
  });
});
