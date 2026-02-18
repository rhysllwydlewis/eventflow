/**
 * ConversationList Component
 * Manages the sidebar conversation list
 */

'use strict';

// This component would be initialized by MessengerApp
// For now, creating a basic implementation that works with the HTML structure

(function() {
  'use strict';
  
  // Wait for MessengerApp to be ready
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.messengerApp) {
      console.warn('MessengerApp not available');
      return;
    }

    const app = window.messengerApp;
    const state = app.state;
    
    // Listen for conversation changes
    state.on('conversationsChanged', renderConversations);
    state.on('filterChanged', renderConversations);
    
    // Setup filter tabs
    const tabs = document.querySelectorAll('.messenger-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('messenger-tab--active'));
        tab.classList.add('messenger-tab--active');
        state.setFilter('active', tab.dataset.filter);
      });
    });
    
    // Setup search
    const searchInput = document.getElementById('conversationSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.setFilter('search', e.target.value);
      });
    }
    
    // New conversation button
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
      newConversationBtn.addEventListener('click', () => {
        document.getElementById('contactPickerModal').style.display = 'block';
      });
    }
    
    function renderConversations() {
      const listEl = document.getElementById('conversationList');
      const loadingEl = document.getElementById('conversationsLoading');
      const emptyEl = document.getElementById('conversationsEmpty');
      
      const conversations = state.getFilteredConversations();
      
      if (!conversations || conversations.length === 0) {
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'flex';
        // Clear any existing items
        Array.from(listEl.children).forEach(child => {
          if (!child.id || (!child.id.includes('Loading') && !child.id.includes('Empty'))) {
            child.remove();
          }
        });
        return;
      }
      
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'none';
      
      // Clear existing items (except loading/empty)
      Array.from(listEl.children).forEach(child => {
        if (!child.id || (!child.id.includes('Loading') && !child.id.includes('Empty'))) {
          child.remove();
        }
      });
      
      // Render conversations
      conversations.forEach(conv => {
        const el = createConversationElement(conv, state.currentUser);
        listEl.appendChild(el);
      });
    }
    
    function createConversationElement(conversation, currentUser) {
      const div = document.createElement('div');
      div.className = 'conversation-item';
      div.dataset.id = conversation._id;
      
      // Find other participant
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUser.id);
      const myParticipant = conversation.participants.find(p => p.userId === currentUser.id);
      
      if (myParticipant?.unreadCount > 0) {
        div.classList.add('unread');
      }
      
      if (state.activeConversationId === conversation._id) {
        div.classList.add('active');
      }
      
      // Check presence status from state
      const presence = state.getPresence(otherParticipant?.userId);
      const isOnline = presence.state === 'online';
      
      div.innerHTML = `
        <div class="messenger-avatar ${isOnline ? 'messenger-avatar--online' : ''}">
          ${otherParticipant?.avatar || 'U'}
        </div>
        <div class="conversation-item__content">
          <div class="conversation-item__header">
            <h3 class="conversation-name">${otherParticipant?.displayName || 'User'}</h3>
            <span class="conversation-time">${formatTime(conversation.updatedAt)}</span>
          </div>
          <p class="conversation-preview">
            ${conversation.lastMessage?.content || 'No messages yet'}
          </p>
          <div class="conversation-item__badges">
            ${myParticipant?.unreadCount > 0 ? `<span class="unread-badge">${myParticipant.unreadCount}</span>` : ''}
            ${myParticipant?.isPinned ? '<span class="pinned-indicator">📌</span>' : ''}
          </div>
        </div>
      `;
      
      div.addEventListener('click', () => {
        state.setActiveConversation(conversation._id);
        
        // On mobile, hide sidebar
        if (window.innerWidth <= 768) {
          document.querySelector('.messenger-sidebar').classList.add('hidden');
          document.querySelector('.messenger-main').classList.remove('hidden');
        }
      });
      
      return div;
    }
    
    function formatTime(date) {
      if (!date) return '';
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    }
  });
})();
