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
    const subscriptionFilter = document.getElementById('subscriptionFilter')?.value || '';
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

      // Subscription filter
      if (subscriptionFilter) {
        const userTier = u.subscription?.tier || 'free';
        if (userTier !== subscriptionFilter) {
          return false;
        }
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
        '<tr><td colspan="9" class="small">No users found matching your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(u => {
        // Get subscription badge
        const subscription = u.subscription || { tier: 'free', status: 'active' };
        let subscriptionBadge = '';
        if (subscription.tier === 'pro') {
          subscriptionBadge = '<span class="badge badge-pro">Pro</span>';
        } else if (subscription.tier === 'pro_plus') {
          subscriptionBadge = '<span class="badge badge-pro-plus">Pro+</span>';
        } else {
          subscriptionBadge = '<span class="badge badge-free">Free</span>';
        }

        const actionsHtml = `
          <button class="btn btn-secondary btn-sm" data-manage-subscription="${escapeHtml(u.id || u._id || '')}" style="font-size:12px;padding:4px 8px;margin-right:4px;">Manage Subscription</button>
          ${
            !u.verified
              ? `<button class="btn btn-secondary btn-sm" data-resend-verification="${escapeHtml(u.id || u._id || '')}" style="font-size:12px;padding:4px 8px;">Resend Verification</button>`
              : ''
          }
        `;

        return (
          `<tr>` +
          `<td><a href="/admin-user-detail.html?id=${escapeHtml(u.id || u._id || '')}" style="color:#3b82f6;text-decoration:none;">${escapeHtml(u.name || '')}</a></td>` +
          `<td><a href="/admin-user-detail.html?id=${escapeHtml(u.id || u._id || '')}" style="color:#3b82f6;text-decoration:none;">${escapeHtml(u.email || '')}</a></td>` +
          `<td>${escapeHtml(u.role || '')}</td>` +
          `<td>${subscriptionBadge}</td>` +
          `<td>${u.verified ? '✓ Yes' : '✗ No'}</td>` +
          `<td>${u.marketingOptIn ? 'Yes' : 'No'}</td>` +
          `<td>${formatDate(u.createdAt)}</td>` +
          `<td>${formatDate(u.lastLoginAt)}</td>` +
          `<td>${actionsHtml}</td>` +
          `</tr>`
        );
      })
      .join('');

    // Add event listeners to manage subscription buttons
    document.querySelectorAll('[data-manage-subscription]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const userId = e.target.getAttribute('data-manage-subscription');
        if (userId) {
          openSubscriptionModal(userId);
        }
      });
    });

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
    const subscriptionFilter = document.getElementById('subscriptionFilter');
    const verifiedFilter = document.getElementById('verifiedFilter');
    const clearBtn = document.getElementById('clearFilters');

    // Debounced search for better performance
    if (searchInput) {
      if (window.AdminShared && window.AdminShared.debounce) {
        const debouncedRender = window.AdminShared.debounce(renderUsers, 300);
        searchInput.addEventListener('input', debouncedRender);
      } else {
        searchInput.addEventListener('input', renderUsers);
      }
    }

    if (roleFilter) {
      roleFilter.addEventListener('change', renderUsers);
    }

    if (subscriptionFilter) {
      subscriptionFilter.addEventListener('change', renderUsers);
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
        if (subscriptionFilter) {
          subscriptionFilter.value = '';
        }
        if (verifiedFilter) {
          verifiedFilter.value = '';
        }
        renderUsers();
      });
    }
  }

  // Subscription Modal Management
  let currentSubscriptionUserId = null;

  function openSubscriptionModal(userId) {
    currentSubscriptionUserId = userId;
    const modal = document.getElementById('subscriptionModal');
    if (!modal) {
      return;
    }

    modal.style.display = 'flex';
    document.getElementById('subscriptionUserId').value = userId;

    // Load current subscription status and history
    loadSubscriptionData(userId);
  }

  function closeSubscriptionModal() {
    const modal = document.getElementById('subscriptionModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentSubscriptionUserId = null;

    // Reset form
    const form = document.getElementById('subscriptionForm');
    if (form) {
      form.reset();
    }
  }

  async function loadSubscriptionData(userId) {
    const statusDiv = document.getElementById('currentSubscriptionStatus');
    const historyDiv = document.getElementById('subscriptionHistory');

    if (!statusDiv || !historyDiv) {
      return;
    }

    // Find user from allUsers
    const user = allUsers.find(u => u.id === userId);

    if (!user) {
      statusDiv.innerHTML = '<p class="text-error">User not found</p>';
      historyDiv.innerHTML = '<p class="text-error">Unable to load history</p>';
      return;
    }

    // Display current subscription
    const subscription = user.subscription || { tier: 'free', status: 'active' };
    const tierDisplay =
      subscription.tier === 'pro' ? 'Pro' : subscription.tier === 'pro_plus' ? 'Pro+' : 'Free';
    const statusClass = subscription.status === 'active' ? 'badge-success' : 'badge-secondary';
    const endDateDisplay = subscription.endDate
      ? `Expires: ${formatDate(subscription.endDate)}`
      : subscription.tier !== 'free'
        ? 'Lifetime'
        : '';

    statusDiv.innerHTML = `
      <div class="subscription-status-card">
        <div><strong>Tier:</strong> <span class="badge ${statusClass}">${tierDisplay}</span></div>
        <div><strong>Status:</strong> ${subscription.status || 'N/A'}</div>
        ${endDateDisplay ? `<div><strong>${endDateDisplay}</strong></div>` : ''}
        ${subscription.reason ? `<div><strong>Reason:</strong> ${escapeHtml(subscription.reason)}</div>` : ''}
      </div>
    `;

    // Load subscription history
    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription-history`);
      if (!response.ok) {
        throw new Error('Failed to load subscription history');
      }

      const data = await response.json();
      const history = data.history || [];

      if (history.length === 0) {
        historyDiv.innerHTML = '<p class="text-muted">No subscription history</p>';
      } else {
        historyDiv.innerHTML = history
          .map(
            h => `
          <div class="subscription-history-item">
            <div><strong>${h.action}</strong> - ${h.tier === 'pro' ? 'Pro' : h.tier === 'pro_plus' ? 'Pro+' : 'Free'}</div>
            <div class="text-muted">${formatDate(h.date)}</div>
            <div class="text-muted">By: ${escapeHtml(h.adminEmail || 'Unknown')}</div>
            ${h.reason ? `<div class="text-muted">Reason: ${escapeHtml(h.reason)}</div>` : ''}
            ${h.endDate ? `<div class="text-muted">End Date: ${formatDate(h.endDate)}</div>` : ''}
          </div>
        `
          )
          .join('');
      }
    } catch (error) {
      console.error('Error loading subscription history:', error);
      historyDiv.innerHTML = '<p class="text-error">Failed to load subscription history</p>';
    }
  }

  function setupSubscriptionModal() {
    const closeBtn = document.getElementById('closeSubscriptionModal');
    const cancelBtn = document.getElementById('cancelSubscriptionBtn');
    const form = document.getElementById('subscriptionForm');
    const removeBtn = document.getElementById('removeSubscriptionBtn');
    const modal = document.getElementById('subscriptionModal');

    // Close modal handlers
    if (closeBtn) {
      closeBtn.addEventListener('click', closeSubscriptionModal);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeSubscriptionModal);
    }

    // Click outside to close
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          closeSubscriptionModal();
        }
      });
    }

    // Handle tier change - hide duration if free is selected
    const tierSelect = document.getElementById('subscriptionTier');
    const durationGroup = document.getElementById('subscriptionDuration')?.parentElement;

    if (tierSelect && durationGroup) {
      tierSelect.addEventListener('change', e => {
        if (e.target.value === 'free') {
          durationGroup.style.display = 'none';
          document.getElementById('subscriptionDuration').removeAttribute('required');
        } else {
          durationGroup.style.display = 'block';
          document.getElementById('subscriptionDuration').setAttribute('required', 'required');
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();

        const userId = document.getElementById('subscriptionUserId').value;
        const tier = document.getElementById('subscriptionTier').value;
        const duration = document.getElementById('subscriptionDuration').value;
        const reason = document.getElementById('subscriptionReason').value;

        if (!userId) {
          alert('No user selected');
          return;
        }

        // If tier is free, remove subscription instead
        if (tier === 'free') {
          if (!confirm('This will remove the current subscription. Continue?')) {
            return;
          }

          try {
            const response = await fetch(`/api/admin/users/${userId}/subscription`, {
              method: 'DELETE',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ reason: reason || 'Admin set to free tier' }),
            });

            const data = await response.json();

            if (response.ok) {
              alert(data.message || 'Subscription removed successfully');
              closeSubscriptionModal();
              loadAdminUsers(); // Reload users
            } else {
              alert(data.error || 'Failed to remove subscription');
            }
          } catch (error) {
            console.error('Error removing subscription:', error);
            alert('Network error - please try again');
          }
          return;
        }

        if (!tier || !duration) {
          alert('Please select both tier and duration');
          return;
        }

        try {
          const response = await fetch(`/api/admin/users/${userId}/subscription`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tier, duration, reason }),
          });

          const data = await response.json();

          if (response.ok) {
            alert(data.message || 'Subscription granted successfully');
            closeSubscriptionModal();
            loadAdminUsers(); // Reload users
          } else {
            alert(data.error || 'Failed to grant subscription');
          }
        } catch (error) {
          console.error('Error granting subscription:', error);
          alert('Network error - please try again');
        }
      });
    }

    // Remove subscription button
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!currentSubscriptionUserId) {
          alert('No user selected');
          return;
        }

        const reason = prompt('Reason for removing subscription:');
        if (reason === null) {
          return; // Cancelled
        }

        if (!confirm('Are you sure you want to remove this subscription?')) {
          return;
        }

        try {
          const response = await fetch(
            `/api/admin/users/${currentSubscriptionUserId}/subscription`,
            {
              method: 'DELETE',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ reason: reason || 'Manual admin removal' }),
            }
          );

          const data = await response.json();

          if (response.ok) {
            alert(data.message || 'Subscription removed successfully');
            closeSubscriptionModal();
            loadAdminUsers(); // Reload users
          } else {
            alert(data.error || 'Failed to remove subscription');
          }
        } catch (error) {
          console.error('Error removing subscription:', error);
          alert('Network error - please try again');
        }
      });
    }
  }

  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadAdminUsers();
      setupFilterListeners();
      setupSubscriptionModal();
    });
  } else {
    loadAdminUsers();
    setupFilterListeners();
    setupSubscriptionModal();
  }
})();
