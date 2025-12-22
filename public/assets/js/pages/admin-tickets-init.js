import ticketingSystem from './assets/js/ticketing.js';

let allTickets = [];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
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
    allTickets = await ticketingSystem.getAllTickets();
    renderTickets();
  } catch (error) {
    console.error('Error loading tickets:', error);
    const container = document.getElementById('ticketsContainer');
    container.innerHTML =
      '<p class="small" style="color:#ef4444;">Failed to load tickets. Make sure you are signed in as an admin.</p>';
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
  let filtered = allTickets.filter(ticket => {
    // Search filter
    if (searchTerm) {
      const subject = (ticket.subject || '').toLowerCase();
      const message = (ticket.message || '').toLowerCase();
      const senderName = (ticket.senderName || '').toLowerCase();
      if (!subject.includes(searchTerm) && !message.includes(searchTerm) && !senderName.includes(searchTerm)) {
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
      <div class="empty-state">
        <div class="empty-state-icon">🎫</div>
        <h3 class="empty-state-title">No tickets found</h3>
        <p class="empty-state-description">
          ${allTickets.length === 0 ? 'Support tickets will appear here when customers submit them.' : 'No tickets match your current filters.'}
        </p>
        <button class="btn btn-primary" id="refreshBtn">Refresh</button>
      </div>
    `;
    
    document.getElementById('refreshBtn')?.addEventListener('click', loadTickets);
    return;
  }

  let html = '';

  filtered.forEach(ticket => {
    const statusClass = ticketingSystem.getStatusClass(ticket.status);
    const priorityClass = ticketingSystem.getPriorityClass(ticket.priority);
    const createdAt = formatDate(ticket.createdAt);
    const responseCount = ticket.responses ? ticket.responses.length : 0;
    const userName = ticket.senderName || ticket.senderEmail || 'Unknown User';
    const userId = ticket.senderId || '';

    html += `
      <div class="ticket-card" data-ticket-id="${ticket.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <div>
            <h3 style="margin:0 0 0.25rem 0;font-size:1rem;">
              <a href="/admin-ticket-detail.html?id=${ticket.id}" style="color:#1a1a1a;text-decoration:none;">${escapeHtml(ticket.subject)}</a>
            </h3>
            <div class="small">
              By: <a href="/admin-user-detail.html?id=${userId}" style="color:#3b82f6;">${escapeHtml(userName)}</a>
              • ${createdAt}
            </div>
          </div>
          <div style="display:flex;gap:0.25rem;">
            <span class="badge badge-${ticket.status}">${ticket.status.replace('_', ' ')}</span>
            <span class="badge badge-priority-${ticket.priority}">${ticket.priority}</span>
          </div>
        </div>
        <p class="small" style="margin:0.5rem 0;color:#6b7280;">${escapeHtml((ticket.message || '').substring(0, 120))}${(ticket.message || '').length > 120 ? '...' : ''}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
          <div class="small" style="color:#9ca3af;">
            ${responseCount} response${responseCount !== 1 ? 's' : ''}
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-small btn-primary" data-action="viewTicket" data-id="${ticket.id}">View</button>
            <button class="btn btn-small btn-secondary" data-action="assignTicket" data-id="${ticket.id}">Assign</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add click handlers for ticket cards
  container.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on a button or link
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) {
        return;
      }
      const ticketId = card.getAttribute('data-ticket-id');
      viewTicket(ticketId);
    });
  });
}

function viewTicket(ticketId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';

  modal.innerHTML = `
    <div class="modal" style="max-width:700px;">
      <div class="modal-header">
        <h3>Support Ticket</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto;">
        <div id="ticketDetails"><p class="small">Loading...</p></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    if (ticketUnsubscribe) {
      ticketUnsubscribe();
    }
    modal.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  let ticketUnsubscribe = null;

  const renderTicketDetails = ticket => {
    if (!ticket) {
      document.getElementById('ticketDetails').innerHTML = '<p class="small">Ticket not found.</p>';
      return;
    }

    const statusClass = ticketingSystem.getStatusClass(ticket.status);
    const priorityClass = ticketingSystem.getPriorityClass(ticket.priority);
    const createdAt = formatDate(ticket.createdAt);

    let html = `
      <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e4e4e7;">
        <div style="display:flex;justify-content:space-between;margin-bottom:1rem;">
          <div style="display:flex;gap:0.5rem;">
            <span class="badge badge-${ticket.status}">${ticket.status.replace('_', ' ')}</span>
            <span class="badge badge-priority-${ticket.priority}">${ticket.priority}</span>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <select id="statusSelect" style="padding:0.25rem 0.5rem;border:1px solid #d4d4d8;border-radius:4px;font-size:12px;">
              <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
          </div>
        </div>
        <h4 style="margin:0.5rem 0;">${escapeHtml(ticket.subject)}</h4>
        <p class="small" style="color:#9ca3af;margin:0.5rem 0;">
          From: ${escapeHtml(ticket.senderName)} (${escapeHtml(ticket.senderEmail)}) • ${createdAt}
        </p>
        <p style="margin:0.5rem 0;">${escapeHtml(ticket.message)}</p>
      </div>
    `;

    if (ticket.responses && ticket.responses.length > 0) {
      html += '<h4>Responses</h4>';
      html +=
        '<div class="responses-list" style="max-height:300px;overflow-y:auto;margin-bottom:1rem;">';

      ticket.responses.forEach(response => {
        const respTimestamp = formatDate(response.timestamp);
        const isAdmin = response.responderType === 'admin';

        html += `
          <div style="margin-bottom:1rem;padding:1rem;background:${isAdmin ? '#eff6ff' : '#fafafa'};border-radius:4px;border-left:3px solid ${isAdmin ? '#3b82f6' : '#9ca3af'};">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
              <strong>${escapeHtml(response.responderName)} ${isAdmin ? '<span class="badge badge-yes">Admin</span>' : ''}</strong>
              <span class="small" style="color:#9ca3af;">${respTimestamp}</span>
            </div>
            <p style="margin:0;">${escapeHtml(response.message)}</p>
          </div>
        `;
      });

      html += '</div>';
    }

    // Add response form
    html += `
      <h4>Add Response</h4>
      <form id="responseForm">
        <div class="form-row">
          <textarea id="responseMessage" rows="4" placeholder="Type your response..." required style="width:100%;padding:0.5rem;border:1px solid #d4d4d8;border-radius:4px;"></textarea>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
          <button type="submit" class="btn btn-primary">Send Response</button>
        </div>
      </form>
    `;

    document.getElementById('ticketDetails').innerHTML = html;

    // Status change handler
    document.getElementById('statusSelect').addEventListener('change', async e => {
      try {
        await ticketingSystem.updateStatus(ticketId, e.target.value);
        if (typeof Toast !== 'undefined') {
          Toast.success('Status updated');
        }
        loadTickets(); // Refresh list
      } catch (error) {
        console.error('Error updating status:', error);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to update status');
        }
      }
    });

    // Response form handler
    document.getElementById('responseForm').addEventListener('submit', async e => {
      e.preventDefault();

      const messageText = document.getElementById('responseMessage').value.trim();
      if (!messageText) {
        return;
      }

      try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        // Get current admin user
        const response = await fetch('/api/me');
        const user = await response.json();

        await ticketingSystem.addResponse(ticketId, {
          responderId: user.id,
          responderType: 'admin',
          responderName: user.name || user.email || 'Admin',
          message: messageText,
        });

        document.getElementById('responseMessage').value = '';

        if (typeof Toast !== 'undefined') {
          Toast.success('Response sent');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Response';
      } catch (error) {
        console.error('Error sending response:', error);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to send response');
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Response';
      }
    });
  };

  ticketUnsubscribe = ticketingSystem.listenToTicket(ticketId, renderTicketDetails);
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
  location.href = '/admin.html';
});

// Event delegation for dynamically created buttons
document.body.addEventListener('click', function(e) {
  var target = e.target;
  if (target.tagName !== 'BUTTON') return;
  
  var action = target.getAttribute('data-action');
  if (!action) return;
  
  var id = target.getAttribute('data-id');
  
  switch(action) {
    case 'viewTicket':
      if (id) viewTicket(id);
      break;
    case 'assignTicket':
      if (id) {
        // TODO: Implement assign functionality
        alert('Assign functionality coming soon');
      }
      break;
  }
});

// Initialize
setupFilterListeners();
ticketingSystem.listenToAllTickets(tickets => {
  allTickets = tickets;
  renderTickets();
});
