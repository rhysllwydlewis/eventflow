/**
 * Admin Payment Analytics Initialization
 * Displays payment analytics and transaction history for administrators
 * Uses MongoDB API instead of Firebase
 */

let revenueChart = null;
let plansChart = null;

// Filter state
let currentFilters = {
  status: 'all',
  plan: 'all',
  days: 'all',
};

/**
 * Load payment data from MongoDB API
 */
async function loadPayments() {
  try {
    const response = await AdminShared.api('/api/admin/payments');
    return response.items || [];
  } catch (error) {
    console.error('Error loading payments:', error);
    AdminShared.showToast('Failed to load payments', 'error');
    return [];
  }
}

/**
 * Load supplier data to enrich payment information
 */
async function loadSuppliers() {
  try {
    const response = await AdminShared.api('/api/admin/suppliers');
    const suppliers = {};
    
    if (response.items) {
      response.items.forEach(supplier => {
        suppliers[supplier.id] = supplier;
      });
    }
    
    return suppliers;
  } catch (error) {
    console.error('Error loading suppliers:', error);
    return {};
  }
}

/**
 * Filter payments based on current filters
 */
function filterPayments(payments) {
  let filtered = [...payments];

  // Filter by status
  if (currentFilters.status !== 'all') {
    filtered = filtered.filter(p => p.status === currentFilters.status);
  }

  // Filter by plan
  if (currentFilters.plan !== 'all') {
    filtered = filtered.filter(p => p.planId === currentFilters.plan);
  }

  // Filter by date
  if (currentFilters.days !== 'all') {
    const days = parseInt(currentFilters.days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filtered = filtered.filter(p => {
      const paymentDate = new Date(p.createdAt);
      return paymentDate >= cutoffDate;
    });
  }

  return filtered;
}

/**
 * Calculate statistics from payments
 */
function calculateStats(payments) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = {
    totalRevenue: 0,
    activeSubscriptions: 0,
    totalTransactions: payments.length,
    monthRevenue: 0,
    revenueByMonth: {},
    planDistribution: {},
  };

  payments.forEach(payment => {
    const amount = payment.total || payment.amount || 0;
    const paymentDate = new Date(payment.createdAt);
    const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    // Total revenue (only successful payments)
    if (payment.status === 'success' || payment.status === 'completed' || payment.status === 'pending') {
      stats.totalRevenue += amount;

      // Revenue by month
      if (!stats.revenueByMonth[monthKey]) {
        stats.revenueByMonth[monthKey] = 0;
      }
      stats.revenueByMonth[monthKey] += amount;

      // This month's revenue
      if (
        paymentDate.getMonth() === currentMonth &&
        paymentDate.getFullYear() === currentYear
      ) {
        stats.monthRevenue += amount;
      }
    }

    // Count active subscriptions (payments with active status)
    if (payment.status === 'success' || payment.status === 'completed') {
      stats.activeSubscriptions++;
    }

    // Plan distribution
    const planId = payment.planId || 'unknown';
    if (!stats.planDistribution[planId]) {
      stats.planDistribution[planId] = 0;
    }
    stats.planDistribution[planId]++;
  });

  return stats;
}

/**
 * Render statistics cards
 */
function renderStats(stats) {
  const totalRevenueEl = document.getElementById('totalRevenue');
  const activeSubscriptionsEl = document.getElementById('activeSubscriptions');
  const totalTransactionsEl = document.getElementById('totalTransactions');
  const monthRevenueEl = document.getElementById('monthRevenue');

  if (totalRevenueEl) totalRevenueEl.textContent = `£${stats.totalRevenue.toFixed(2)}`;
  if (activeSubscriptionsEl) activeSubscriptionsEl.textContent = stats.activeSubscriptions;
  if (totalTransactionsEl) totalTransactionsEl.textContent = stats.totalTransactions;
  if (monthRevenueEl) monthRevenueEl.textContent = `£${stats.monthRevenue.toFixed(2)}`;

  // Update change indicators
  const revenueChangeEl = document.getElementById('revenueChange');
  const subscriptionChangeEl = document.getElementById('subscriptionChange');
  const transactionChangeEl = document.getElementById('transactionChange');
  const monthChangeEl = document.getElementById('monthChange');

  if (revenueChangeEl) revenueChangeEl.textContent = 'All time total';
  if (subscriptionChangeEl) subscriptionChangeEl.textContent = 'Currently active';
  if (transactionChangeEl) transactionChangeEl.textContent = 'All transactions';
  if (monthChangeEl) monthChangeEl.textContent = 'This month';
}

/**
 * Render revenue chart
 */
function renderRevenueChart(stats) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;

  // Destroy existing chart
  if (revenueChart) {
    revenueChart.destroy();
  }

  // Get last 12 months
  const months = [];
  const revenues = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    months.push(monthLabel);
    revenues.push(stats.revenueByMonth[monthKey] || 0);
  }

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Revenue (£)',
          data: revenues,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return '£' + value.toFixed(0);
            },
          },
        },
      },
    },
  });
}

/**
 * Render plans distribution chart
 */
function renderPlansChart(stats) {
  const ctx = document.getElementById('plansChart');
  if (!ctx) return;

  // Destroy existing chart
  if (plansChart) {
    plansChart.destroy();
  }

  const planLabels = {
    pro_monthly: 'Pro Monthly',
    pro_plus_monthly: 'Pro+ Monthly',
    pro_yearly: 'Pro Yearly',
    pro_plus_yearly: 'Pro+ Yearly',
    unknown: 'Unknown',
  };

  const labels = [];
  const data = [];
  const colors = [
    'rgb(59, 130, 246)',
    'rgb(147, 51, 234)',
    'rgb(16, 185, 129)',
    'rgb(245, 158, 11)',
    'rgb(156, 163, 175)',
  ];

  Object.entries(stats.planDistribution).forEach(([planId, count]) => {
    labels.push(planLabels[planId] || planId);
    data.push(count);
  });

  plansChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
    },
  });
}

/**
 * Render payments table
 */
function renderPaymentsTable(payments, suppliers) {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">
          No payment data available
        </td>
      </tr>
    `;
    return;
  }

  const planNames = {
    pro_monthly: 'Pro Monthly',
    pro_plus_monthly: 'Pro+ Monthly',
    pro_yearly: 'Pro Yearly',
    pro_plus_yearly: 'Pro+ Yearly',
  };

  tbody.innerHTML = payments
    .map(payment => {
      const supplier = suppliers[payment.supplierId];
      const supplierName = supplier?.name || supplier?.companyName || 'Unknown';
      const planName = planNames[payment.planId] || payment.planId || 'N/A';
      const amount = payment.total || payment.amount || 0;
      const date = new Date(payment.createdAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const statusClass =
        payment.status === 'success' || payment.status === 'completed'
          ? 'success'
          : payment.status === 'pending'
          ? 'pending'
          : 'failed';

      return `
        <tr>
          <td>${date}</td>
          <td>${AdminShared.escapeHtml(supplierName)}</td>
          <td>${planName}</td>
          <td>£${amount.toFixed(2)}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${payment.status || 'unknown'}
            </span>
          </td>
          <td style="font-family: monospace; font-size: 0.875rem;">
            ${(payment.id || '').substring(0, 8)}...
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Initialize the page
 */
async function init() {
  // Load data
  const [payments, suppliers] = await Promise.all([loadPayments(), loadSuppliers()]);

  // Filter payments
  const filteredPayments = filterPayments(payments);

  // Calculate stats
  const stats = calculateStats(filteredPayments);

  // Render everything
  renderStats(stats);
  renderRevenueChart(stats);
  renderPlansChart(stats);
  renderPaymentsTable(filteredPayments, suppliers);

  // Set up event listeners
  setupEventListeners(payments, suppliers);
}

/**
 * Setup event listeners
 */
function setupEventListeners(payments, suppliers) {
  // Filter listeners
  const statusFilter = document.getElementById('statusFilter');
  const planFilter = document.getElementById('planFilter');
  const dateFilter = document.getElementById('dateFilter');

  if (statusFilter) {
    statusFilter.addEventListener('change', e => {
      currentFilters.status = e.target.value;
      refreshData(payments, suppliers);
    });
  }

  if (planFilter) {
    planFilter.addEventListener('change', e => {
      currentFilters.plan = e.target.value;
      refreshData(payments, suppliers);
    });
  }

  if (dateFilter) {
    dateFilter.addEventListener('change', e => {
      currentFilters.days = e.target.value;
      refreshData(payments, suppliers);
    });
  }

  // Make refresh function available globally for navbar refresh button
  window.refreshDashboardData = async () => {
    const [newPayments, newSuppliers] = await Promise.all([loadPayments(), loadSuppliers()]);
    refreshData(newPayments, newSuppliers);
    AdminShared.showToast('Payment data refreshed', 'success');
  };
}

/**
 * Refresh data with current filters
 */
function refreshData(payments, suppliers) {
  const filteredPayments = filterPayments(payments);
  const stats = calculateStats(filteredPayments);

  renderStats(stats);
  renderRevenueChart(stats);
  renderPlansChart(stats);
  renderPaymentsTable(filteredPayments, suppliers);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
