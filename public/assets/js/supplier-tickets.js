/**
 * Supplier Ticketing Interface
 * Handles ticket creation and viewing for suppliers
 */

import ticketingSystem from './ticketing.js';

let ticketsUnsubscribe = null;

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/v1/auth/me', {
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Render tickets
function renderTickets(tickets) {
  const container = document.getElementById('tickets-sup');
  if (!container) {
    return;
  }

  if (!tickets || tickets.length === 0) {
    container.innerHTML =
      '<p class="small">No support tickets yet. Create one if you need help!</p>';
    return;
  }

  let html = '<div class="ticket-list">';

  tickets.forEach(ticket => {
    const status = typeof ticket?.status === 'string' ? ticket.status : 'open';
    const priority = typeof ticket?.priority === 'string' ? ticket.priority : 'medium';
    const message = typeof ticket?.message === 'string' ? ticket.message : '';
    const statusClass = ticketingSystem.getStatusClass(status);
    const priorityClass = ticketingSystem.getPriorityClass(priority);
    const createdAt = ticketingSystem.formatTimestamp(ticket?.createdAt);
    const responseCount = Array.isArray(ticket?.responses) ? ticket.responses.length : 0;

    html += `
      <div class="ticket-item" style="border:1px solid #e4e4e7;padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;" data-ticket-id="${ticket.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <strong>${escapeHtml(ticket.subject)}</strong>
          <div style="display:flex;gap:0.5rem;">
            <span class="badge ${statusClass}">${status.replace('_', ' ')}</span>
            <span class="badge ${priorityClass}">${priority}</span>
          </div>
        </div>
        <p class="small" style="margin:0.5rem 0;color:#6b7280;">${escapeHtml(message.substring(0, 100))}${message.length > 100 ? '...' : ''}</p>
        <div class="small" style="color:#9ca3af;">
          Created ${createdAt} • ${responseCount} response${responseCount !== 1 ? 's' : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Add click handlers
  container.querySelectorAll('.ticket-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticketId = item.getAttribute('data-ticket-id');
      viewTicket(ticketId);
    });
  });
}

// Create ticket modal
function showCreateTicketModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header">
        <h3>Create Support Ticket</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <form id="createTicketForm">
          <div class="form-row">
            <label for="ticketSubject">Subject *</label>
            <input type="text" id="ticketSubject" required placeholder="Brief description of your issue">
          </div>
          <div class="form-row">
            <label for="ticketMessage">Message *</label>
            <textarea id="ticketMessage" rows="6" required placeholder="Describe your issue in detail"></textarea>
          </div>
          <div class="form-row">
            <label for="ticketPriority">Priority</label>
            <select id="ticketPriority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div class="form-actions" style="margin-top:1rem;">
            <button type="submit" class="btn btn-primary">Submit Ticket</button>
            <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => {
    modal.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Form submit
  modal.querySelector('#createTicketForm').addEventListener('submit', async e => {
    e.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Please sign in to create a ticket');
      }
      return;
    }

    const ticketData = {
      senderId: user.id,
      senderType: 'supplier',
      senderName: user.name || user.email,
      senderEmail: user.email,
      subject: document.getElementById('ticketSubject').value,
      message: document.getElementById('ticketMessage').value,
      priority: document.getElementById('ticketPriority').value,
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      await ticketingSystem.createTicket(ticketData);

      if (typeof Toast !== 'undefined') {
        Toast.success('Ticket created successfully');
      } else {
        alert('Ticket created successfully');
      }

      closeModal();
    } catch (error) {
      console.error('Error creating ticket:', error);
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to create ticket: ${error.message}`);
      } else {
        alert(`Failed to create ticket: ${error.message}`);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Ticket';
      }
    }
  });
}

// View ticket modal
function viewTicket(ticketId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h3>Support Ticket</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <div id="ticketDetails"><p class="small">Loading...</p></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
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

  // Load ticket details with real-time updates
  let ticketUnsubscribe = null;

  const renderTicketDetails = ticket => {
    if (!ticket) {
      document.getElementById('ticketDetails').innerHTML = '<p class="small">Ticket not found.</p>';
      return;
    }

    const status = typeof ticket?.status === 'string' ? ticket.status : 'open';
    const priority = typeof ticket?.priority === 'string' ? ticket.priority : 'medium';
    const message = typeof ticket?.message === 'string' ? ticket.message : '';
    const statusClass = ticketingSystem.getStatusClass(status);
    const priorityClass = ticketingSystem.getPriorityClass(priority);
    const createdAt = ticketingSystem.formatTimestamp(ticket?.createdAt);

    let html = `
      <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e4e4e7;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span class="badge ${statusClass}">${status.replace('_', ' ')}</span>
          <span class="badge ${priorityClass}">${priority}</span>
        </div>
        <h4 style="margin:0.5rem 0;">${escapeHtml(ticket.subject)}</h4>
        <p style="margin:0.5rem 0;">${escapeHtml(message)}</p>
        <p class="small" style="color:#9ca3af;margin:0.5rem 0 0;">Created ${createdAt}</p>
      </div>
    `;

    if (ticket.responses && ticket.responses.length > 0) {
      html += '<h4>Conversation</h4>';
      html += '<div class="responses-list">';

      ticket.responses.forEach(response => {
        const respTimestamp = ticketingSystem.formatTimestamp(
          response.createdAt || response.timestamp
        );
        const role = response.userRole || response.responderType || 'supplier';
        const isAdmin = role === 'admin';
        const displayName = response.userName || response.responderName || 'Support';

        html += `
          <div style="margin-bottom:1rem;padding:1rem;background:${isAdmin ? '#eff6ff' : '#fafafa'};border-radius:8px;border-left:3px solid ${isAdmin ? '#3b82f6' : '#9ca3af'};">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;gap:0.75rem;">
              <strong>${escapeHtml(displayName)} ${isAdmin ? '<span class="badge badge-in_progress">Admin</span>' : ''}</strong>
              <span class="small" style="color:#9ca3af;">${respTimestamp}</span>
            </div>
            <p style="margin:0;">${escapeHtml(response.message)}</p>
          </div>
        `;
      });

      html += '</div>';
    } else {
      html +=
        '<p class="small" style="color:#9ca3af;">No responses yet. Our team will reply soon.</p>';
    }

    if (status !== 'closed') {
      html += `
        <form id="ticketReplyForm" style="margin-top:1rem;border-top:1px solid #e5e7eb;padding-top:1rem;">
          <label for="ticketReplyMessage" class="small" style="display:block;margin-bottom:0.5rem;color:#4b5563;">Add a reply</label>
          <textarea id="ticketReplyMessage" rows="4" required placeholder="Add more details for support..." style="width:100%;"></textarea>
          <div style="margin-top:0.75rem;display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Send Reply</button>
          </div>
        </form>
      `;
    }

    document.getElementById('ticketDetails').innerHTML = html;

    const replyForm = document.getElementById('ticketReplyForm');
    if (replyForm) {
      replyForm.addEventListener('submit', async event => {
        event.preventDefault();
        const field = document.getElementById('ticketReplyMessage');
        const message = field.value.trim();
        if (!message) {
          return;
        }

        const button = replyForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Sending...';

        try {
          await ticketingSystem.addResponse(ticket.id, message);
          field.value = '';
          if (typeof Toast !== 'undefined') {
            Toast.success('Reply sent');
          }
        } catch (error) {
          console.error('Error sending reply:', error);
          if (typeof Toast !== 'undefined') {
            Toast.error(error.message || 'Failed to send reply');
          }
        } finally {
          button.disabled = false;
          button.textContent = 'Send Reply';
        }
      });
    }
  };

  // Listen to real-time updates
  ticketUnsubscribe = ticketingSystem.listenToTicket(ticketId, renderTicketDetails);
}

// Initialize
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    const container = document.getElementById('tickets-sup');
    if (container) {
      container.innerHTML = '<p class="small">Sign in to view your support tickets.</p>';
    }
    return;
  }

  // Create ticket button handler
  const createBtn = document.getElementById('createSupplierTicketBtn');
  if (createBtn) {
    createBtn.addEventListener('click', showCreateTicketModal);
  }

  // Listen to user's tickets with real-time updates
  try {
    if (ticketsUnsubscribe) {
      ticketsUnsubscribe();
    }
    ticketsUnsubscribe = ticketingSystem.listenToUserTickets(user.id, 'supplier', renderTickets);
  } catch (error) {
    console.error('Error listening to tickets:', error);
    const container = document.getElementById('tickets-sup');
    if (container) {
      container.innerHTML =
        '<p class="small">Unable to load tickets. Please try refreshing the page.</p>';
    }
  }
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('beforeunload', () => {
  if (ticketsUnsubscribe) {
    ticketsUnsubscribe();
  }
  ticketingSystem.cleanup();
});
