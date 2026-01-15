/**
 * Supplier Analytics Chart
 * Chart.js integration for supplier dashboard analytics
 */

import { initCountUp } from './count-up-animation.js';

/**
 * Load Chart.js library if not already loaded
 * @returns {Promise<void>}
 */
async function loadChartJS() {
  if (window.Chart) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/vendor/chart.umd.js';
    script.onload = resolve;
    script.onerror = () => {
      // Fallback to CDN if local file fails
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js';
      cdnScript.onload = resolve;
      cdnScript.onerror = reject;
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
}

/**
 * Create analytics chart
 * @param {string} canvasId - Canvas element ID
 * @param {object} data - Chart data
 * @param {object} options - Chart options
 */
export async function createAnalyticsChart(canvasId, data, options = {}) {
  try {
    await loadChartJS();

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas element with id "${canvasId}" not found`);
      return null;
    }

    const ctx = canvas.getContext('2d');

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              family: "'Inter', -apple-system, sans-serif",
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(11, 18, 32, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y;
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: {
              size: 11,
            },
            precision: 0,
          },
        },
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...(options.plugins || {}),
      },
      scales: {
        ...defaultOptions.scales,
        ...(options.scales || {}),
      },
    };

    return new Chart(ctx, {
      type: 'line',
      data: data,
      options: mergedOptions,
    });
  } catch (error) {
    console.error('Error creating analytics chart:', error);
    return null;
  }
}

/**
 * Create supplier performance chart widget
 * @param {string} containerId - Container element ID
 * @param {Array} viewsData - Views data array
 * @param {Array} enquiriesData - Enquiries data array
 * @param {Array} labels - Date labels
 */
export async function createPerformanceChart(containerId, viewsData, enquiriesData, labels) {
  const container = document.getElementById(containerId);
  if (!container) {
    return null;
  }

  const canvasId = `${containerId}-canvas`;

  const html = `
    <div class="card" style="padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap;">
        <h3 style="margin: 0; font-size: 1.25rem; color: #0B1220;">Performance Analytics</h3>
        <div style="display: flex; gap: 0.5rem;">
          <button class="chart-period-btn active" data-period="7" style="padding: 0.5rem 1rem; border: 1px solid #E7EAF0; background: white; border-radius: 8px; cursor: pointer; font-size: 0.875rem; transition: all 0.2s;">7 Days</button>
          <button class="chart-period-btn" data-period="30" style="padding: 0.5rem 1rem; border: 1px solid #E7EAF0; background: white; border-radius: 8px; cursor: pointer; font-size: 0.875rem; transition: all 0.2s;">30 Days</button>
          <button class="chart-period-btn" data-period="90" style="padding: 0.5rem 1rem; border: 1px solid #E7EAF0; background: white; border-radius: 8px; cursor: pointer; font-size: 0.875rem; transition: all 0.2s;">90 Days</button>
        </div>
      </div>
      <div class="chart-container" style="position: relative; height: 300px;">
        <canvas id="${canvasId}"></canvas>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Create gradient for views
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const viewsGradient = ctx.createLinearGradient(0, 0, 0, 300);
  viewsGradient.addColorStop(0, 'rgba(11, 128, 115, 0.3)');
  viewsGradient.addColorStop(1, 'rgba(11, 128, 115, 0.01)');

  const enquiriesGradient = ctx.createLinearGradient(0, 0, 0, 300);
  enquiriesGradient.addColorStop(0, 'rgba(19, 182, 162, 0.3)');
  enquiriesGradient.addColorStop(1, 'rgba(19, 182, 162, 0.01)');

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Profile Views',
        data: viewsData,
        borderColor: '#0B8073',
        backgroundColor: viewsGradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0B8073',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        label: 'Enquiries',
        data: enquiriesData,
        borderColor: '#13B6A2',
        backgroundColor: enquiriesGradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#13B6A2',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chart = await createAnalyticsChart(canvasId, chartData);

  // Add period selector functionality
  const periodButtons = container.querySelectorAll('.chart-period-btn');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      // Update active state
      periodButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'white';
        b.style.borderColor = '#E7EAF0';
        b.style.color = '#667085';
      });
      btn.classList.add('active');
      btn.style.background = 'linear-gradient(135deg, #0B8073 0%, #13B6A2 100%)';
      btn.style.borderColor = 'transparent';
      btn.style.color = 'white';

      const period = parseInt(btn.dataset.period);

      // Fetch new data for the selected period
      // This would be replaced with actual API call
      const newData = await fetchAnalyticsData(period);

      if (chart && newData) {
        chart.data.labels = newData.labels;
        chart.data.datasets[0].data = newData.views;
        chart.data.datasets[1].data = newData.enquiries;
        chart.update('active');
      }
    });
  });

  return chart;
}

/**
 * Fetch analytics data for a specific period
 * @param {number} days - Number of days
 * @returns {Promise<object>} Analytics data
 */
async function fetchAnalyticsData(days) {
  try {
    // This would be replaced with actual API endpoint
    // For now, return mock data
    const labels = [];
    const views = [];
    const enquiries = [];

    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      views.push(Math.floor(Math.random() * 50) + 10);
      enquiries.push(Math.floor(Math.random() * 10) + 1);
    }

    return { labels, views, enquiries };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return null;
  }
}

/**
 * Create simple stat summary with icons
 * @param {string} containerId - Container element ID
 * @param {object} stats - Statistics object
 */
export function createAnalyticsSummary(containerId, stats) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const { views7d = 0, totalEnquiries = 0, responseRate = 0, avgResponseTime = 0 } = stats;

  const html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-widget card" style="padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="icon-with-gradient" style="background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div style="flex: 1;">
            <div class="stat-number" data-target="${views7d}" data-start="0">0</div>
            <div class="stat-label">Views (7d)</div>
          </div>
        </div>
      </div>
      
      <div class="stat-widget card" style="padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="icon-with-gradient" style="background: linear-gradient(135deg, #10B981 0%, #34D399 100%);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div style="flex: 1;">
            <div class="stat-number" data-target="${totalEnquiries}" data-start="0">0</div>
            <div class="stat-label">Total Enquiries</div>
          </div>
        </div>
      </div>
      
      <div class="stat-widget card" style="padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="icon-with-gradient" style="background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div style="flex: 1;">
            <div class="stat-number" data-target="${responseRate}" data-format="percent" data-start="0">0%</div>
            <div class="stat-label">Response Rate</div>
          </div>
        </div>
      </div>
      
      <div class="stat-widget card" style="padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="icon-with-gradient pulse" style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div style="flex: 1;">
            <div class="stat-number" data-target="${avgResponseTime}" data-format="time" data-start="0">0h</div>
            <div class="stat-label">Avg Response Time</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Initialize count-up animations
  setTimeout(() => {
    initCountUp(`#${containerId} [data-target]`);
  }, 100);
}

// Export functions
export default {
  createAnalyticsChart,
  createPerformanceChart,
  createAnalyticsSummary,
  loadChartJS,
};
