/**
 * Customer Ticketing Interface
 * Handles ticket creation and viewing for customers
 */

import ticketingSystem from './ticketing.js';

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Render tickets
function renderTickets(tickets) {
  const container = document.getElementById('tickets-cust');
  if (!container) return;

  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<p class="small">No support tickets yet. Create one if you need help!</p>';
    return;
  }

  let html = '<div class="ticket-list">';
  
  tickets.forEach(ticket => {
    const statusClass = ticketingSystem.getStatusClass(ticket.status);
    const priorityClass = ticketingSystem.getPriorityClass(ticket.priority);
    const createdAt = ticketingSystem.formatTimestamp(ticket.createdAt);
    const responseCount = ticket.responses ? ticket.responses.length : 0;
    
    html += `
      <div class="ticket-item" style="border:1px solid #e4e4e7;padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;" data-ticket-id="${ticket.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <strong>${escapeHtml(ticket.subject)}</strong>
          <div style="display:flex;gap:0.5rem;">
            <span class="badge ${statusClass}">${ticket.status.replace('_', ' ')}</span>
            <span class="badge ${priorityClass}">${ticket.priority}</span>
          </div>
        </div>
        <p class="small" style="margin:0.5rem 0;color:#6b7280;">${escapeHtml(ticket.message.substring(0, 100))}${ticket.message.length > 100 ? '...' : ''}</p>
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

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Create ticket modal
function showCreateTicketModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
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
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Form submit
  modal.querySelector('#createTicketForm').addEventListener('submit', async (e) => {
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
      senderType: 'customer',
      senderName: user.name || user.email,
      senderEmail: user.email,
      subject: document.getElementById('ticketSubject').value,
      message: document.getElementById('ticketMessage').value,
      priority: document.getElementById('ticketPriority').value
    };

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

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
        Toast.error('Failed to create ticket: ' + error.message);
      } else {
        alert('Failed to create ticket: ' + error.message);
      }
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Ticket';
    }
  });
}

// View ticket modal
function viewTicket(ticketId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
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
    if (ticketUnsubscribe) ticketUnsubscribe();
    modal.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Load ticket details with real-time updates
  let ticketUnsubscribe = null;

  const renderTicketDetails = (ticket) => {
    if (!ticket) {
      document.getElementById('ticketDetails').innerHTML = '<p class="small">Ticket not found.</p>';
      return;
    }

    const statusClass = ticketingSystem.getStatusClass(ticket.status);
    const priorityClass = ticketingSystem.getPriorityClass(ticket.priority);
    const createdAt = ticketingSystem.formatTimestamp(ticket.createdAt);

    let html = `
      <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e4e4e7;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span class="badge ${statusClass}">${ticket.status.replace('_', ' ')}</span>
          <span class="badge ${priorityClass}">${ticket.priority}</span>
        </div>
        <h4 style="margin:0.5rem 0;">${escapeHtml(ticket.subject)}</h4>
        <p style="margin:0.5rem 0;">${escapeHtml(ticket.message)}</p>
        <p class="small" style="color:#9ca3af;margin:0.5rem 0 0;">Created ${createdAt}</p>
      </div>
    `;

    if (ticket.responses && ticket.responses.length > 0) {
      html += '<h4>Responses</h4>';
      html += '<div class="responses-list">';
      
      ticket.responses.forEach(response => {
        const respTimestamp = ticketingSystem.formatTimestamp(response.timestamp);
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
    } else {
      html += '<p class="small" style="color:#9ca3af;">No responses yet. An admin will respond soon.</p>';
    }

    document.getElementById('ticketDetails').innerHTML = html;
  };

  // Listen to real-time updates
  ticketUnsubscribe = ticketingSystem.listenToTicket(ticketId, renderTicketDetails);
}

// Initialize
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    const container = document.getElementById('tickets-cust');
    if (container) {
      container.innerHTML = '<p class="small">Sign in to view your support tickets.</p>';
    }
    return;
  }

  // Create ticket button handler
  const createBtn = document.getElementById('createTicketBtn');
  if (createBtn) {
    createBtn.addEventListener('click', showCreateTicketModal);
  }

  // Listen to user's tickets with real-time updates
  ticketingSystem.listenToUserTickets(user.id, 'customer', renderTickets);
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
