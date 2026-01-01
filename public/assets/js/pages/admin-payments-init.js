/**
 * Admin Payment Analytics Initialization
 * Displays payment analytics and transaction history for administrators
 * Uses MongoDB API and integrates with live Stripe analytics
 */

let revenueChart = null;
let plansChart = null;

// Filter state
const currentFilters = {
  status: 'all',
  plan: 'all',
  days: 'all',
};

/**
 * Load live Stripe analytics data
 */
async function loadStripeAnalytics() {
  try {
    const response = await AdminShared.api('/api/admin/stripe-analytics');
    return response;
  } catch (error) {
    console.error('Error loading Stripe analytics:', error);
    return { available: false };
  }
}

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
    if (
      payment.status === 'success' ||
      payment.status === 'completed' ||
      payment.status === 'pending'
    ) {
      stats.totalRevenue += amount;

      // Revenue by month
      if (!stats.revenueByMonth[monthKey]) {
        stats.revenueByMonth[monthKey] = 0;
      }
      stats.revenueByMonth[monthKey] += amount;

      // This month's revenue
      if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
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
function renderStats(stats, stripeAnalytics) {
  const totalRevenueEl = document.getElementById('totalRevenue');
  const activeSubscriptionsEl = document.getElementById('activeSubscriptions');
  const totalTransactionsEl = document.getElementById('totalTransactions');
  const monthRevenueEl = document.getElementById('monthRevenue');

  // Use Stripe data if available, otherwise use local data
  const useStripe = stripeAnalytics && stripeAnalytics.available;

  if (totalRevenueEl) {
    const revenue = useStripe ? stripeAnalytics.totalRevenue : stats.totalRevenue;
    totalRevenueEl.textContent = `£${revenue.toFixed(2)}`;
    totalRevenueEl.title = useStripe ? 'Live Stripe data' : 'Local payment data';
  }
  if (activeSubscriptionsEl) {
    const subs = useStripe
      ? stripeAnalytics.activeSubscriptions
      : stats.activeSubscriptions;
    activeSubscriptionsEl.textContent = subs;
    activeSubscriptionsEl.title = useStripe ? 'Live Stripe data' : 'Local payment data';
  }
  if (totalTransactionsEl) {
    const transactions = useStripe
      ? stripeAnalytics.totalCharges
      : stats.totalTransactions;
    totalTransactionsEl.textContent = transactions;
    totalTransactionsEl.title = useStripe ? 'Live Stripe data' : 'Local payment data';
  }
  if (monthRevenueEl) {
    const monthRev = useStripe ? stripeAnalytics.monthRevenue : stats.monthRevenue;
    monthRevenueEl.textContent = `£${monthRev.toFixed(2)}`;
    monthRevenueEl.title = useStripe ? 'Live Stripe data (last 30 days)' : 'This month';
  }

  // Update change indicators
  const revenueChangeEl = document.getElementById('revenueChange');
  const subscriptionChangeEl = document.getElementById('subscriptionChange');
  const transactionChangeEl = document.getElementById('transactionChange');
  const monthChangeEl = document.getElementById('monthChange');

  if (revenueChangeEl) {
    revenueChangeEl.textContent = useStripe
      ? '💳 Live from Stripe'
      : 'All time total (local data)';
    revenueChangeEl.style.color = useStripe ? '#10b981' : '#6b7280';
  }
  if (subscriptionChangeEl) {
    subscriptionChangeEl.textContent = useStripe
      ? '💳 Live from Stripe'
      : 'Currently active';
    subscriptionChangeEl.style.color = useStripe ? '#10b981' : '#6b7280';
  }
  if (transactionChangeEl) {
    transactionChangeEl.textContent = useStripe
      ? '💳 Live from Stripe'
      : 'All transactions';
    transactionChangeEl.style.color = useStripe ? '#10b981' : '#6b7280';
  }
  if (monthChangeEl) {
    monthChangeEl.textContent = useStripe ? 'Last 30 days' : 'This month';
  }
}

/**
 * Render revenue chart
 */
function renderRevenueChart(stats) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) {
    return;
  }

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
              return `£${value.toFixed(0)}`;
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
  if (!ctx) {
    return;
  }

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
  if (!tbody) {
    return;
  }

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
  const [payments, suppliers, stripeAnalytics] = await Promise.all([
    loadPayments(),
    loadSuppliers(),
    loadStripeAnalytics(),
  ]);

  // Update Stripe status indicator
  const stripeStatusEl = document.getElementById('stripeStatus');
  if (stripeStatusEl) {
    if (stripeAnalytics && stripeAnalytics.available) {
      stripeStatusEl.textContent = '✓ Connected';
      stripeStatusEl.style.background = '#dcfce7';
      stripeStatusEl.style.color = '#166534';
      AdminShared.showToast('💳 Live Stripe analytics loaded', 'success');
    } else {
      stripeStatusEl.textContent = '○ Not Configured';
      stripeStatusEl.style.background = '#fef3c7';
      stripeStatusEl.style.color = '#92400e';
    }
  }

  // Filter payments
  const filteredPayments = filterPayments(payments);

  // Calculate stats
  const stats = calculateStats(filteredPayments);

  // Render everything
  renderStats(stats, stripeAnalytics);
  renderRevenueChart(stats);
  renderPlansChart(stats);
  renderPaymentsTable(filteredPayments, suppliers);

  // Set up event listeners
  setupEventListeners(payments, suppliers, stripeAnalytics);
}

/**
 * Setup event listeners
 */
function setupEventListeners(payments, suppliers, stripeAnalytics) {
  // Filter listeners
  const statusFilter = document.getElementById('statusFilter');
  const planFilter = document.getElementById('planFilter');
  const dateFilter = document.getElementById('dateFilter');

  if (statusFilter) {
    statusFilter.addEventListener('change', e => {
      currentFilters.status = e.target.value;
      refreshData(payments, suppliers, stripeAnalytics);
    });
  }

  if (planFilter) {
    planFilter.addEventListener('change', e => {
      currentFilters.plan = e.target.value;
      refreshData(payments, suppliers, stripeAnalytics);
    });
  }

  if (dateFilter) {
    dateFilter.addEventListener('change', e => {
      currentFilters.days = e.target.value;
      refreshData(payments, suppliers, stripeAnalytics);
    });
  }

  // Make refresh function available globally for navbar refresh button
  window.refreshDashboardData = async () => {
    const [newPayments, newSuppliers, newStripeAnalytics] = await Promise.all([
      loadPayments(),
      loadSuppliers(),
      loadStripeAnalytics(),
    ]);
    refreshData(newPayments, newSuppliers, newStripeAnalytics);
    AdminShared.showToast('Payment data refreshed', 'success');
  };
}

/**
 * Refresh data with current filters
 */
function refreshData(payments, suppliers, stripeAnalytics) {
  const filteredPayments = filterPayments(payments);
  const stats = calculateStats(filteredPayments);

  renderStats(stats, stripeAnalytics);
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
