// Standalone admin users loader (doesn't depend on app.js functions)
(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) {
      return 'Never';
    }
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  }

  async function loadAdminUsers() {
    const summary = document.getElementById('user-summary');
    const tbody = document.querySelector('table.table tbody');
    if (!summary || !tbody) {
      return;
    }

    summary.textContent = 'Loading users…';

    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data = await response.json();
      const items = (data && data.items) || [];

      summary.textContent = items.length
        ? `${items.length} user${items.length === 1 ? '' : 's'} registered.`
        : 'No users found.';

      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="small">No users found.</td></tr>';
        return;
      }

      tbody.innerHTML = items
        .map(u => {
          return (
            `<tr>` +
            `<td>${escapeHtml(u.name || '')}</td>` +
            `<td>${escapeHtml(u.email || '')}</td>` +
            `<td>${escapeHtml(u.role || '')}</td>` +
            `<td>${u.verified ? 'Yes' : 'No'}</td>` +
            `<td>${u.marketingOptIn ? 'Yes' : 'No'}</td>` +
            `<td>${formatDate(u.createdAt)}</td>` +
            `<td>${formatDate(u.lastLoginAt)}</td>` +
            `</tr>`
          );
        })
        .join('');
    } catch (e) {
      console.error('Admin users load failed', e);
      summary.textContent = 'Error loading users';
      tbody.innerHTML =
        '<tr><td colspan="7" class="small" style="color:#ef4444;">Failed to load users. Please make sure you are logged in as an admin.</td></tr>';
    }
  }

  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAdminUsers);
  } else {
    loadAdminUsers();
  }
})();
