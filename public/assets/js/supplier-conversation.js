/**
 * MongoDB-based supplier page conversations
 * Uses REST API for thread messaging
 */

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user; // Return the user object from the response
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Intercept the conversation start
async function enhanceConversationButton() {
  // Wait for the start-thread button to be added to the DOM
  const checkButton = setInterval(() => {
    const startThreadBtn = document.getElementById('start-thread');
    if (startThreadBtn) {
      clearInterval(checkButton);
      setupFirebaseConversation(startThreadBtn);
    }
  }, 100);

  // Stop checking after 5 seconds
  setTimeout(() => clearInterval(checkButton), 5000);
}

function setupFirebaseConversation(originalButton) {
  // Get the supplier ID from the page
  const getSupplierId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  };

  // Remove all existing listeners
  const newButton = originalButton.cloneNode(true);
  originalButton.parentNode.replaceChild(newButton, originalButton);

  // Add new conversation handler
  newButton.addEventListener('click', async () => {
    const user = await getCurrentUser();
    if (!user) {
      alert('You need an account to contact suppliers. Please sign in or create an account.');
      return;
    }

    if (user.role !== 'customer') {
      alert(
        'Only customers can start conversations with suppliers. Please sign in with a customer account.'
      );
      return;
    }

    const supplierId = getSupplierId();
    if (!supplierId) {
      alert('Supplier not found');
      return;
    }

    // Get supplier info
    let supplierInfo = null;
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`);
      if (response.ok) {
        const data = await response.json();
        supplierInfo = data;
      }
    } catch (error) {
      console.error('Error fetching supplier:', error);
    }

    // Open conversation modal
    openFirebaseConversationModal(user, supplierId, supplierInfo);
  });
}

function openFirebaseConversationModal(user, supplierId, supplierInfo) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';

  modal.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h3>Start Conversation</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p class="small" style="margin-bottom:1rem;">Send a message to ${escapeHtml(supplierInfo?.name || 'this supplier')}. They will receive your message and can respond directly.</p>
        <form id="startConversationForm">
          <div class="form-row">
            <label for="conversationMessage">Your Message *</label>
            <textarea id="conversationMessage" rows="6" required placeholder="Hi! We are planning an event on [DATE] for around [GUESTS] guests at [LOCATION]. Are you available, and could you share your pricing or packages?"></textarea>
          </div>
          <div class="form-actions" style="margin-top:1rem;">
            <button type="submit" class="cta">Send Message</button>
            <button type="button" class="cta secondary modal-close-btn">Cancel</button>
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
  modal.querySelector('#startConversationForm').addEventListener('submit', async e => {
    e.preventDefault();

    const messageText = document.getElementById('conversationMessage').value.trim();
    if (!messageText) {
      return;
    }

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      // Send message via MongoDB API
      const response = await fetch('/api/threads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId: supplierId,
          message: messageText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      closeModal();

      if (typeof Toast !== 'undefined') {
        Toast.success('Message sent! The supplier will respond soon.');
      } else {
        alert('Message sent! Visit your dashboard to continue the conversation.');
      }

      // Redirect to customer dashboard
      setTimeout(() => {
        window.location.href = '/dashboard-customer.html';
      }, 1500);
    } catch (error) {
      console.error('Error starting conversation:', error);
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to send message: ${error.message}`);
      } else {
        alert(`Failed to send message: ${error.message}`);
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Initialize when page loads
if (window.location.pathname.includes('supplier.html')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceConversationButton);
  } else {
    enhanceConversationButton();
  }
}

export { enhanceConversationButton };
