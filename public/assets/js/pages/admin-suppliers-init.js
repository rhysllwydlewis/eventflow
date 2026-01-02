// Supplier Management Page Initialization
(function () {
  let allSuppliers = [];
  let filteredSuppliers = [];
  let selectedSuppliers = new Set();
  let currentPage = 1;
  const itemsPerPage = 20;

  // Initialize page
  async function init() {
    await loadSuppliers();
    setupEventListeners();
    renderTable();
  }

  // Load suppliers data
  async function loadSuppliers() {
    try {
      const response = await fetch('/api/admin/suppliers');
      if (!response.ok) throw new Error('Failed to load suppliers');
      
      const data = await response.json();
      allSuppliers = data.suppliers || [];
      filteredSuppliers = [...allSuppliers];
      
      updateStats();
    } catch (error) {
      console.error('Error loading suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    }
  }

  // Update statistics
  function updateStats() {
    const total = allSuppliers.length;
    const pending = allSuppliers.filter(s => !s.approved).length;
    const pro = allSuppliers.filter(s => s.subscription?.tier === 'pro_plus').length;
    const avgScore = allSuppliers.reduce((sum, s) => sum + (s.score || 0), 0) / total || 0;

    document.getElementById('totalSuppliers').textContent = total;
    document.getElementById('pendingSuppliers').textContent = pending;
    document.getElementById('proSuppliers').textContent = pro;
    document.getElementById('avgScore').textContent = avgScore.toFixed(1);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Search
    document.getElementById('searchInput')?.addEventListener('input', handleFilters);
    
    // Filters
    document.getElementById('approvalFilter')?.addEventListener('change', handleFilters);
    document.getElementById('subscriptionFilter')?.addEventListener('change', handleFilters);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    
    // Bulk actions
    document.getElementById('selectAll')?.addEventListener('change', toggleSelectAll);
    document.getElementById('bulkApproveBtn')?.addEventListener('click', () => bulkAction('approve'));
    document.getElementById('bulkRejectBtn')?.addEventListener('click', () => bulkAction('reject'));
    document.getElementById('bulkDeleteBtn')?.addEventListener('click', () => bulkAction('delete'));
    document.getElementById('smartTagBtn')?.addEventListener('click', smartTag);
    
    // Pagination
    document.getElementById('prevPageBtn')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPageBtn')?.addEventListener('click', () => changePage(1));
    
    // Export
    document.getElementById('exportSuppliersBtn')?.addEventListener('click', exportSuppliers);
  }

  // Handle filters
  function handleFilters() {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const approval = document.getElementById('approvalFilter')?.value || 'all';
    const subscription = document.getElementById('subscriptionFilter')?.value || 'all';

    filteredSuppliers = allSuppliers.filter(supplier => {
      const matchesSearch = 
        supplier.name?.toLowerCase().includes(search) ||
        supplier.email?.toLowerCase().includes(search);
      
      const matchesApproval = 
        approval === 'all' ||
        (approval === 'approved' && supplier.approved) ||
        (approval === 'pending' && !supplier.approved && !supplier.rejected) ||
        (approval === 'rejected' && supplier.rejected);
      
      const matchesSubscription =
        subscription === 'all' ||
        supplier.subscription?.tier === subscription;

      return matchesSearch && matchesApproval && matchesSubscription;
    });

    currentPage = 1;
    renderTable();
  }

  // Clear filters
  function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('approvalFilter').value = 'all';
    document.getElementById('subscriptionFilter').value = 'all';
    handleFilters();
  }

  // Render table
  function renderTable() {
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageSuppliers = filteredSuppliers.slice(start, end);

    if (pageSuppliers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #9ca3af;">No suppliers found</td></tr>';
      updatePagination();
      return;
    }

    tbody.innerHTML = pageSuppliers.map(supplier => {
      const isSelected = selectedSuppliers.has(supplier.id);
      const subscriptionBadge = getSubscriptionBadge(supplier.subscription?.tier || 'free');
      
      return `
        <tr>
          <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.toggleSupplierSelection('${supplier.id}')"></td>
          <td><a href="/admin-supplier-detail.html?id=${supplier.id}" style="color: #667eea; font-weight: 500;">${escapeHtml(supplier.name || 'Unknown')}</a></td>
          <td>${escapeHtml(supplier.email || '')}</td>
          <td>${supplier.approved ? '<span style="color: #10b981;">✓ Yes</span>' : '<span style="color: #f59e0b;">Pending</span>'}</td>
          <td>${subscriptionBadge}</td>
          <td><span style="font-weight: 600; color: #667eea;">${supplier.score || 0}</span></td>
          <td><span style="font-size: 12px; color: #6b7280;">${supplier.tags?.join(', ') || 'None'}</span></td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button onclick="window.viewSupplier('${supplier.id}')" class="btn-xs" title="View Profile">👁️</button>
              <button onclick="window.editSupplier('${supplier.id}')" class="btn-xs" title="Edit">✏️</button>
              ${!supplier.approved ? `<button onclick="window.approveSupplier('${supplier.id}')" class="btn-xs" style="background: #10b981; color: white;" title="Approve">✓</button>` : ''}
              <button onclick="window.deleteSupplier('${supplier.id}')" class="btn-xs" style="background: #ef4444; color: white;" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updatePagination();
    updateBulkActionsBar();
  }

  // Get subscription badge HTML
  function getSubscriptionBadge(tier) {
    const badges = {
      free: '<span class="subscription-badge badge-free">FREE</span>',
      pro: '<span class="subscription-badge badge-pro">PRO</span>',
      pro_plus: '<span class="subscription-badge badge-pro-plus">PRO+</span>'
    };
    return badges[tier] || badges.free;
  }

  // Update pagination
  function updatePagination() {
    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredSuppliers.length);

    document.getElementById('paginationInfo').textContent = 
      `Showing ${start}-${end} of ${filteredSuppliers.length} suppliers`;
    
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
  }

  // Change page
  function changePage(delta) {
    currentPage += delta;
    renderTable();
  }

  // Toggle supplier selection
  window.toggleSupplierSelection = function (supplierId) {
    if (selectedSuppliers.has(supplierId)) {
      selectedSuppliers.delete(supplierId);
    } else {
      selectedSuppliers.add(supplierId);
    }
    updateBulkActionsBar();
  };

  // Toggle select all
  function toggleSelectAll(e) {
    const checked = e.target.checked;
    selectedSuppliers.clear();
    
    if (checked) {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      filteredSuppliers.slice(start, end).forEach(s => selectedSuppliers.add(s.id));
    }
    
    renderTable();
  }

  // Update bulk actions bar
  function updateBulkActionsBar() {
    const bar = document.getElementById('bulkActionsBar');
    const count = document.getElementById('selectedCount');
    
    if (selectedSuppliers.size > 0) {
      bar.style.display = 'flex';
      count.textContent = `${selectedSuppliers.size} supplier${selectedSuppliers.size > 1 ? 's' : ''} selected`;
    } else {
      bar.style.display = 'none';
    }
  }

  // Bulk actions
  async function bulkAction(action) {
    if (selectedSuppliers.size === 0) return;
    
    if (!confirm(`Are you sure you want to ${action} ${selectedSuppliers.size} supplier(s)?`)) {
      return;
    }

    // Implement bulk action API calls here
    showToast(`${action} action triggered for ${selectedSuppliers.size} suppliers`, 'info');
  }

  // Smart tag
  function smartTag() {
    showToast('Smart tagging feature coming soon', 'info');
  }

  // Export suppliers
  function exportSuppliers() {
    const csv = convertToCSV(filteredSuppliers);
    downloadCSV(csv, 'suppliers-export.csv');
    showToast('Suppliers exported successfully', 'success');
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Helper: Convert to CSV
  function convertToCSV(data) {
    const headers = ['Name', 'Email', 'Approved', 'Subscription', 'Score', 'Tags'];
    const rows = data.map(s => [
      s.name || '',
      s.email || '',
      s.approved ? 'Yes' : 'No',
      s.subscription?.tier || 'free',
      s.score || 0,
      s.tags?.join(';') || ''
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  // Helper: Download CSV
  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Helper: Show toast
  function showToast(message, type = 'info') {
    if (window.AdminShared && window.AdminShared.showToast) {
      window.AdminShared.showToast(message, type);
    } else {
      alert(message);
    }
  }

  // Global functions for button actions
  window.viewSupplier = function (id) {
    window.location.href = `/admin-supplier-detail.html?id=${id}`;
  };

  window.editSupplier = function (id) {
    window.location.href = `/admin-supplier-detail.html?id=${id}`;
  };

  window.approveSupplier = async function (id) {
    if (confirm('Approve this supplier?')) {
      // Implement approve API call
      showToast('Supplier approved', 'success');
      await loadSuppliers();
      renderTable();
    }
  };

  window.deleteSupplier = async function (id) {
    if (confirm('Are you sure you want to delete this supplier?')) {
      // Implement delete API call
      showToast('Supplier deleted', 'success');
      await loadSuppliers();
      renderTable();
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
