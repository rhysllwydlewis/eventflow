/**
 * Supplier Dashboard Enhancements
 * Adds export buttons and other P3 features
 */

(function () {
  'use strict';

  /**
   * Add CSV export button to enquiries section
   */
  function addExportButton() {
    // Wait for dashboard to load
    const observer = new MutationObserver(() => {
      // Look for enquiries section or stats
      const statsSection = document.querySelector('.stats-grid, .dashboard-stats, #stats-section');
      
      if (statsSection) {
        // Check if export button already exists
        if (document.getElementById('export-enquiries-btn')) {
          observer.disconnect();
          return;
        }

        // Create export button
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-enquiries-btn';
        exportBtn.className = 'btn btn-secondary';
        exportBtn.innerHTML = '📥 Export Enquiries';
        exportBtn.style.marginTop = '1rem';
        
        exportBtn.addEventListener('click', async () => {
          try {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting...';
            
            const response = await fetch('/api/supplier/enquiries/export', {
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error('Export failed');
            }
            
            // Download the CSV file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `enquiries-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            exportBtn.disabled = false;
            exportBtn.innerHTML = '📥 Export Enquiries';
            
            // Show success message
            alert('Enquiries exported successfully!');
          } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export enquiries. Please try again.');
            exportBtn.disabled = false;
            exportBtn.innerHTML = '📥 Export Enquiries';
          }
        });

        // Add button after stats section
        statsSection.insertAdjacentElement('afterend', exportBtn);
        
        observer.disconnect();
      }
    });

    // Start observing
    const main = document.querySelector('main, #main-content');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });
    }

    // Also try immediate addition
    setTimeout(addExportButton, 2000);
  }

  /**
   * Trigger confetti on trial activation success
   */
  function setupTrialConfetti() {
    // Listen for trial activation
    const trialBtn = document.querySelector('#activate-trial-btn, [data-action="activate-trial"]');
    if (trialBtn) {
      trialBtn.addEventListener('click', () => {
        // Wait a bit for the success response
        setTimeout(() => {
          if (typeof triggerSuccessConfetti === 'function') {
            triggerSuccessConfetti();
          }
        }, 1000);
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addExportButton();
      setupTrialConfetti();
    });
  } else {
    addExportButton();
    setupTrialConfetti();
  }
})();
