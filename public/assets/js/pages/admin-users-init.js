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

    // Show loading state
    AdminShared.showLoadingState(tbody, {
      rows: 5,
      cols: 9,
      message: 'Loading users...',
    });

    try {
      // Use AdminShared.adminFetch for consistent error handling
      const data = await AdminShared.adminFetch('/api/admin/users', { method: 'GET' });
      allUsers = (data && data.items) || [];

      renderUsers();
    } catch (e) {
      AdminShared.debugError('Admin users load failed', e);
      summary.textContent = 'Error loading users';

      // Show error state with retry button
      AdminShared.showErrorState(tbody, {
        message: 'Failed to load users. Please try again.',
        onRetry: loadAdminUsers,
        colspan: 9,
      });
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
      // Show empty state
      AdminShared.showEmptyState(tbody, {
        message: 'No users found matching your filters.',
        icon: '👥',
        actionLabel: 'Clear Filters',
        onAction: () => {
          // Clear all filters
          const searchInput = document.getElementById('userSearch');
          const roleFilter = document.getElementById('roleFilter');
          const subscriptionFilter = document.getElementById('subscriptionFilter');
          const verifiedFilter = document.getElementById('verifiedFilter');

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
        },
        colspan: 9,
      });
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

        // Use showConfirmModal instead of browser confirm
        const confirmed = await AdminShared.showConfirmModal({
          title: 'Resend Verification Email',
          message: 'Send a new verification email to this user?',
          confirmText: 'Send Email',
          cancelText: 'Cancel',
          type: 'info',
        });

        if (!confirmed) {
          return;
        }

        // Use safeAction for consistent button state management
        await AdminShared.safeAction(
          btn,
          async () => {
            const data = await AdminShared.adminFetch(
              `/api/admin/users/${userId}/resend-verification`,
              { method: 'POST' }
            );
            return data;
          },
          {
            loadingText: 'Sending...',
            successMessage: 'Verification email sent successfully',
            errorMessage: 'Failed to send verification email',
          }
        );
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

    // Find user from allUsers (handle both id and _id)
    const user = allUsers.find(u => u.id === userId || u._id === userId);

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

    // Load subscription history using AdminShared.adminFetch
    try {
      const data = await AdminShared.adminFetch(`/api/admin/users/${userId}/subscription-history`, {
        method: 'GET',
      });
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
      AdminShared.debugError('Error loading subscription history:', error);
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
          AdminShared.showToast('No user selected', 'error');
          return;
        }

        // If tier is free, remove subscription instead
        if (tier === 'free') {
          const confirmed = await AdminShared.showConfirmModal({
            title: 'Remove Subscription',
            message: 'This will remove the current subscription. Continue?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            type: 'warning',
          });

          if (!confirmed) {
            return;
          }

          const submitBtn = form.querySelector('button[type="submit"]');
          await AdminShared.safeAction(
            submitBtn,
            async () => {
              const data = await AdminShared.adminFetch(`/api/admin/users/${userId}/subscription`, {
                method: 'DELETE',
                body: { reason: reason || 'Admin set to free tier' },
              });
              closeSubscriptionModal();
              loadAdminUsers(); // Reload users
              return data;
            },
            {
              loadingText: 'Removing...',
              successMessage: 'Subscription removed successfully',
              errorMessage: 'Failed to remove subscription',
            }
          );
          return;
        }

        if (!tier || !duration) {
          AdminShared.showToast('Please select both tier and duration', 'error');
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        await AdminShared.safeAction(
          submitBtn,
          async () => {
            const data = await AdminShared.adminFetch(`/api/admin/users/${userId}/subscription`, {
              method: 'POST',
              body: { tier, duration, reason },
            });
            closeSubscriptionModal();
            loadAdminUsers(); // Reload users
            return data;
          },
          {
            loadingText: 'Granting...',
            successMessage: 'Subscription granted successfully',
            errorMessage: 'Failed to grant subscription',
          }
        );
      });
    }

    // Remove subscription button
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!currentSubscriptionUserId) {
          AdminShared.showToast('No user selected', 'error');
          return;
        }

        // Use modal for reason input instead of prompt
        const confirmed = await AdminShared.showConfirmModal({
          title: 'Remove Subscription',
          message:
            'Are you sure you want to remove this subscription? This action cannot be undone.',
          confirmText: 'Remove',
          cancelText: 'Cancel',
          type: 'danger',
        });

        if (!confirmed) {
          return;
        }

        const reasonResult = await AdminShared.showInputModal({
          title: 'Removal Reason',
          message: 'Please provide a reason for removing this subscription',
          label: 'Reason',
          placeholder: 'e.g., Requested by user, Payment issue, etc.',
          required: false,
          type: 'textarea',
        });

        if (!reasonResult.confirmed) {
          return; // Cancelled
        }

        await AdminShared.safeAction(
          removeBtn,
          async () => {
            const data = await AdminShared.adminFetch(
              `/api/admin/users/${currentSubscriptionUserId}/subscription`,
              {
                method: 'DELETE',
                body: { reason: reasonResult.value || 'Manual admin removal' },
              }
            );
            closeSubscriptionModal();
            loadAdminUsers(); // Reload users
            return data;
          },
          {
            loadingText: 'Removing...',
            successMessage: 'Subscription removed successfully',
            errorMessage: 'Failed to remove subscription',
          }
        );
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
