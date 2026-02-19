/**
 * MongoDB-based supplier page conversations
 * Uses REST API for thread messaging
 */

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/v1/auth/me');
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

  // Clone button to remove all existing event listeners
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
      const response = await fetch(`/api/v1/suppliers/${supplierId}`);
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

      // Get CSRF token
      const csrfResponse = await fetch('/api/v1/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      // Create conversation with initial message using v4 API
      const conversationData = {
        type: 'supplier_network',
        participantIds: [supplierId],
        context: {
          type: 'supplier',
          id: supplierId,
          title: supplierInfo?.name || 'Supplier',
        },
        metadata: {
          source: 'supplier_conversation',
        },
      };

      const response = await fetch('/api/v4/messenger/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(conversationData),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const result = await response.json();
      const conversationId = result.conversation?._id || result.conversation?.id;

      if (!conversationId) {
        throw new Error('No conversation ID returned');
      }

      // Send the initial message (Step 2)
      let messageSent = false;
      try {
        const messageResponse = await fetch(`/api/v4/messenger/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfData.csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            message: messageText,
          }),
        });

        if (!messageResponse.ok) {
          // Conversation created but message failed - redirect anyway
          closeModal();
          if (typeof Toast !== 'undefined') {
            Toast.warning('Conversation created but message failed. Opening conversation...');
          }
          window.location.href = `/messenger/?conversation=${encodeURIComponent(conversationId)}`;
          return;
        }
        
        messageSent = true;
      } catch (msgError) {
        // If message send fails, redirect to conversation anyway
        closeModal();
        if (typeof Toast !== 'undefined') {
          Toast.warning('Conversation created but message failed. Opening conversation...');
        }
        window.location.href = `/messenger/?conversation=${encodeURIComponent(conversationId)}`;
        return;
      }

      if (messageSent) {
        closeModal();

        if (typeof Toast !== 'undefined') {
          Toast.success('Message sent! The supplier will respond soon.');
        } else {
          alert('Message sent! Visit your dashboard to continue the conversation.');
        }

        // Redirect to messenger with this conversation
        setTimeout(() => {
          window.location.href = `/messenger/?conversation=${encodeURIComponent(conversationId)}`;
        }, 1500);
      }
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
