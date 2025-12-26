// Standalone admin users loader with search and filters
(function () {
  let allUsers = [];

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
      allUsers = (data && data.items) || [];

      renderUsers();
    } catch (e) {
      console.error('Admin users load failed', e);
      summary.textContent = 'Error loading users';
      tbody.innerHTML =
        '<tr><td colspan="8" class="small" style="color:#ef4444;">Failed to load users. Please make sure you are logged in as an admin.</td></tr>';
    }
  }

  function renderUsers() {
    const summary = document.getElementById('user-summary');
    const tbody = document.querySelector('table.table tbody');

    // Get filter values
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || '';
    const verifiedFilter = document.getElementById('verifiedFilter')?.value || '';

    // Filter users
    const filtered = allUsers.filter(u => {
      // Search filter
      if (searchTerm) {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        if (!name.includes(searchTerm) && !email.includes(searchTerm)) {
          return false;
        }
      }

      // Role filter
      if (roleFilter && u.role !== roleFilter) {
        return false;
      }

      // Verified filter
      if (verifiedFilter === 'yes' && !u.verified) {
        return false;
      }
      if (verifiedFilter === 'no' && u.verified) {
        return false;
      }

      return true;
    });

    summary.textContent = filtered.length
      ? `${filtered.length} user${filtered.length === 1 ? '' : 's'} found (${allUsers.length} total)`
      : 'No users match the filters.';

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="small">No users found matching your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(u => {
        const actionsHtml = !u.verified
          ? `<button class="btn btn-secondary btn-sm" data-resend-verification="${escapeHtml(u.id || u._id || '')}" style="font-size:12px;padding:4px 8px;">Resend Verification</button>`
          : '-';

        return (
          `<tr>` +
          `<td><a href="/admin-user-detail.html?id=${escapeHtml(u.id || u._id || '')}" style="color:#3b82f6;text-decoration:none;">${escapeHtml(u.name || '')}</a></td>` +
          `<td><a href="/admin-user-detail.html?id=${escapeHtml(u.id || u._id || '')}" style="color:#3b82f6;text-decoration:none;">${escapeHtml(u.email || '')}</a></td>` +
          `<td>${escapeHtml(u.role || '')}</td>` +
          `<td>${u.verified ? '✓ Yes' : '✗ No'}</td>` +
          `<td>${u.marketingOptIn ? 'Yes' : 'No'}</td>` +
          `<td>${formatDate(u.createdAt)}</td>` +
          `<td>${formatDate(u.lastLoginAt)}</td>` +
          `<td>${actionsHtml}</td>` +
          `</tr>`
        );
      })
      .join('');

    // Add event listeners to resend buttons
    document.querySelectorAll('[data-resend-verification]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const userId = e.target.getAttribute('data-resend-verification');
        if (!userId) {
          return;
        }

        if (!confirm('Send a new verification email to this user?')) {
          return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
          const response = await fetch(`/api/admin/users/${userId}/resend-verification`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (response.ok) {
            if (window.AdminShared && window.AdminShared.showToast) {
              window.AdminShared.showToast(
                data.message || 'Verification email sent successfully',
                'success'
              );
            } else {
              alert(data.message || 'Verification email sent successfully');
            }
          } else {
            if (window.AdminShared && window.AdminShared.showToast) {
              window.AdminShared.showToast(
                data.error || 'Failed to send verification email',
                'error'
              );
            } else {
              alert(data.error || 'Failed to send verification email');
            }
          }
        } catch (error) {
          console.error('Error resending verification:', error);
          if (window.AdminShared && window.AdminShared.showToast) {
            window.AdminShared.showToast('Network error - please try again', 'error');
          } else {
            alert('Network error - please try again');
          }
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
  }

  function setupFilterListeners() {
    const searchInput = document.getElementById('userSearch');
    const roleFilter = document.getElementById('roleFilter');
    const verifiedFilter = document.getElementById('verifiedFilter');
    const clearBtn = document.getElementById('clearFilters');

    if (searchInput) {
      searchInput.addEventListener('input', renderUsers);
    }

    if (roleFilter) {
      roleFilter.addEventListener('change', renderUsers);
    }

    if (verifiedFilter) {
      verifiedFilter.addEventListener('change', renderUsers);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
        }
        if (roleFilter) {
          roleFilter.value = '';
        }
        if (verifiedFilter) {
          verifiedFilter.value = '';
        }
        renderUsers();
      });
    }
  }

  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadAdminUsers();
      setupFilterListeners();
    });
  } else {
    loadAdminUsers();
    setupFilterListeners();
  }
})();
