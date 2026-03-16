// Initialize core utilities
document.addEventListener('DOMContentLoaded', () => {
  // Initialize error boundary
  window.errorBoundary = new ErrorBoundary({
    showErrorDetails: window.location.hostname === 'localhost',
  });
});
