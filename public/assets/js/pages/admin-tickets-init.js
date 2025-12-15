import ticketingSystem from './assets/js/ticketing.js';

let allTickets = [];
let currentFilter = 'all';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

async function loadTickets() {
  try {
    allTickets = await ticketingSystem.getAllTickets();
    renderTickets();
  } catch (error) {
    console.error('Error loading tickets:', error);
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '<p class="small" style="color:#ef4444;">Failed to load tickets. Make sure you are signed in as an admin.</p>';
  }
}

function renderTickets() {
  const container = document.getElementById('ticketsContainer');
  if (!container) return;

  const filtered = currentFilter === 'all' 
    ? allTickets 
    : allTickets.filter(t => t.status === currentFilter);

  if (!filtered.length) {
    container.innerHTML = '<p class="small">No tickets found.</p>';
    return;
  }

  let html = '<div class="ticket-list">';
  
  filtered.forEach(ticket => {
    const statusClass = ticketingSystem.getStatusClass(ticket.status);
    const priorityClass = ticketingSystem.getPriorityClass(ticket.priority);
    const createdAt = ticketingSystem.formatTimestamp(ticket.createdAt);
    const responseCount = ticket.responses ? ticket.responses.length : 0;
    
    html += `
      <div class="ticket-item" style="border:1px solid #e4e4e7;padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;" data-ticket-id="${ticket.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <div>
            <strong>${escapeHtml(ticket.subject)}</strong>
            <div class="small" style="color:#9ca3af;margin-top:0.25rem;">
              From: ${escapeHtml(ticket.senderName)} (${escapeHtml(ticket.senderType)})
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-direction:column;align-items:flex-end;">
            <div style="display:flex;gap:0.5rem;">
              <span class="badge ${statusClass}">${ticket.status.replace('_', ' ')}</span>
              <span class="badge ${priorityClass}">${ticket.priority}</span>
            </div>
            <span class="small" style="color:#9ca3af;">${createdAt}</span>
          </div>
        </div>
        <p class="small" style="margin:0.5rem 0;color:#6b7280;">${escapeHtml(ticket.message.substring(0, 150))}${ticket.message.length > 150 ? '...' : ''}</p>
        <div class="small" style="color:#9ca3af;">
          ${responseCount} response${responseCount !== 1 ? 's' : ''}
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
    if (ticketUnsubscribe) ticketUnsubscribe();
    modal.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

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
        <div style="display:flex;justify-content:space-between;margin-bottom:1rem;">
          <div style="display:flex;gap:0.5rem;">
            <span class="badge ${statusClass}">${ticket.status.replace('_', ' ')}</span>
            <span class="badge ${priorityClass}">${ticket.priority}</span>
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
      html += '<div class="responses-list" style="max-height:300px;overflow-y:auto;margin-bottom:1rem;">';
      
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
    document.getElementById('statusSelect').addEventListener('change', async (e) => {
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
    document.getElementById('responseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const messageText = document.getElementById('responseMessage').value.trim();
      if (!messageText) return;

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
          message: messageText
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

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-filter');
    renderTickets();
  });
});

// Back to dashboard button
document.getElementById('backToDashboard').addEventListener('click', function() {
  location.href = '/admin.html';
});

// Initialize
ticketingSystem.listenToAllTickets((tickets) => {
  allTickets = tickets;
  renderTickets();
});
