(function () {
  'use strict';

  let allTickets = [];

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return 'Unknown';
    }
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('en-GB');
    } else if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  async function loadTickets() {
    try {
      const data = await AdminShared.api('/api/admin/tickets');
      allTickets = data.items || [];
      renderTickets();
    } catch (error) {
      console.error('Error loading tickets:', error);
      const container = document.getElementById('ticketsContainer');
      container.innerHTML =
        '<div class="data-section"><p class="small" style="color:#ef4444;">Failed to load tickets. Please try again.</p></div>';
    }
  }

  function renderTickets() {
    const container = document.getElementById('ticketsContainer');
    if (!container) {
      return;
    }

    // Get filter values
    const searchTerm = document.getElementById('ticketSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const priorityFilter = document.getElementById('priorityFilter')?.value || '';
    const assignedFilter = document.getElementById('assignedFilter')?.value || '';

    // Filter tickets
    const filtered = allTickets.filter(ticket => {
      // Search filter
      if (searchTerm) {
        const subject = (ticket.subject || '').toLowerCase();
        const message = (ticket.message || '').toLowerCase();
        const userName = (ticket.userName || '').toLowerCase();
        if (!subject.includes(searchTerm) && !message.includes(searchTerm) && !userName.includes(searchTerm)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter && ticket.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter && ticket.priority !== priorityFilter) {
        return false;
      }

      // Assignment filter
      if (assignedFilter) {
        if (assignedFilter === 'unassigned' && ticket.assignedTo) {
          return false;
        }
        if (assignedFilter === 'assigned' && !ticket.assignedTo) {
          return false;
        }
      }

      return true;
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="data-section">
          <div style="text-align:center;padding:4rem 2rem;">
            <div style="font-size:4rem;margin-bottom:1rem;">🎫</div>
            <h3 style="margin:0 0 0.5rem 0;font-size:1.5rem;">No tickets found</h3>
            <p style="color:#6b7280;margin:0 0 1.5rem 0;">
              ${allTickets.length === 0 ? 'Support tickets will appear here when customers submit them.' : 'No tickets match your current filters.'}
            </p>
          </div>
        </div>
      `;
      return;
    }

    let html = '<div class="table-wrapper"><table><thead><tr><th>Subject</th><th>From</th><th>Status</th><th>Priority</th><th>Created</th><th>Actions</th></tr></thead><tbody>';

    filtered.forEach(ticket => {
      const createdAt = formatDate(ticket.createdAt);
      const userName = ticket.userName || ticket.userEmail || 'Unknown User';
      const userId = ticket.userId || '';
      const replyCount = (ticket.replies || []).length;

      html += `
        <tr>
          <td><strong>${escapeHtml(ticket.subject || 'No subject')}</strong><br><span class="small">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span></td>
          <td><a href="/admin-user-detail.html?id=${escapeHtml(userId)}">${escapeHtml(userName)}</a></td>
          <td><span class="badge badge-${ticket.status || 'open'}">${(ticket.status || 'open').replace('_', ' ')}</span></td>
          <td><span class="badge badge-priority-${ticket.priority || 'low'}">${ticket.priority || 'low'}</span></td>
          <td class="small">${createdAt}</td>
          <td>
            <button class="btn-sm btn-primary" data-action="viewTicket" data-id="${ticket.id}">View</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  // Setup filter listeners
  function setupFilterListeners() {
    const searchInput = document.getElementById('ticketSearch');
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const assignedFilter = document.getElementById('assignedFilter');

    if (searchInput) {
      searchInput.addEventListener('input', renderTickets);
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', renderTickets);
    }

    if (priorityFilter) {
      priorityFilter.addEventListener('change', renderTickets);
    }

    if (assignedFilter) {
      assignedFilter.addEventListener('change', renderTickets);
    }
  }

  // Back to dashboard button
  document.getElementById('backToDashboard')?.addEventListener('click', () => {
    window.location.href = '/admin.html';
  });

  // Initialize
  setupFilterListeners();
  loadTickets();
})();

