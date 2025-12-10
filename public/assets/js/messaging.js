/**
 * Messaging System for EventFlow
 * Handles customer-supplier conversations
 * Uses Firebase Firestore for real-time updates
 */

import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from './firebase-config.js';

class MessagingSystem {
  constructor() {
    this.unsubscribers = [];
  }

  /**
   * Generate conversation ID from customer and supplier IDs
   * @param {string} customerId - Customer ID
   * @param {string} supplierId - Supplier ID
   * @returns {string} Conversation ID
   */
  getConversationId(customerId, supplierId) {
    return `${customerId}_${supplierId}`;
  }

  /**
   * Start or get existing conversation
   * @param {Object} conversationData - Conversation data
   * @returns {Promise<string>} Conversation ID
   */
  async startConversation(conversationData) {
    try {
      const conversationId = this.getConversationId(
        conversationData.customerId,
        conversationData.supplierId
      );
      
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        // Create new conversation
        await setDoc(conversationRef, {
          customerId: conversationData.customerId,
          customerName: conversationData.customerName,
          supplierId: conversationData.supplierId,
          supplierName: conversationData.supplierName,
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        console.log('New conversation created:', conversationId);
      }
      
      return conversationId;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(conversationId, messageData) {
    try {
      // Add message to subcollection
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const message = {
        senderId: messageData.senderId,
        senderType: messageData.senderType, // 'customer' | 'supplier'
        senderName: messageData.senderName,
        message: messageData.message,
        timestamp: serverTimestamp(),
        read: false
      };
      
      const docRef = await addDoc(messagesRef, message);
      
      // Update conversation metadata
      const conversationRef = doc(db, 'conversations', conversationId);
      await setDoc(conversationRef, {
        lastMessage: messageData.message,
        lastMessageTime: serverTimestamp()
      }, { merge: true });
      
      console.log('Message sent:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get all messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Array of messages
   */
  async getMessages(conversationId) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const querySnapshot = await getDocs(q);
      const messages = [];
      querySnapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      
      return messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @returns {Promise<Array>} Array of conversations
   */
  async getUserConversations(userId, userType) {
    try {
      const fieldName = userType === 'customer' ? 'customerId' : 'supplierId';
      const q = query(
        collection(db, 'conversations'),
        where(fieldName, '==', userId),
        orderBy('lastMessageTime', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const conversations = [];
      querySnapshot.forEach((doc) => {
        conversations.push({ id: doc.id, ...doc.data() });
      });
      
      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Listen to messages in a conversation in real-time
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function
   */
  listenToMessages(conversationId, callback) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages = [];
        querySnapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
      }, (error) => {
        console.error('Error listening to messages:', error);
      });
      
      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up message listener:', error);
      throw error;
    }
  }

  /**
   * Listen to user conversations in real-time
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   */
  listenToUserConversations(userId, userType, callback) {
    try {
      const fieldName = userType === 'customer' ? 'customerId' : 'supplierId';
      const q = query(
        collection(db, 'conversations'),
        where(fieldName, '==', userId),
        orderBy('lastMessageTime', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const conversations = [];
        querySnapshot.forEach((doc) => {
          conversations.push({ id: doc.id, ...doc.data() });
        });
        callback(conversations);
      }, (error) => {
        console.error('Error listening to conversations:', error);
      });
      
      this.unsubscribers.push(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up conversation listener:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   */
  async markMessagesAsRead(conversationId, userId) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '!=', userId),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const updates = [];
      
      querySnapshot.forEach((docSnap) => {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', docSnap.id);
        updates.push(setDoc(messageRef, { read: true }, { merge: true }));
      });
      
      await Promise.all(updates);
      console.log('Messages marked as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId, userType) {
    try {
      const conversations = await this.getUserConversations(userId, userType);
      let unreadCount = 0;
      
      for (const conversation of conversations) {
        const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
        const q = query(
          messagesRef,
          where('senderId', '!=', userId),
          where('read', '==', false)
        );
        
        const querySnapshot = await getDocs(q);
        unreadCount += querySnapshot.size;
      }
      
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  /**
   * Format timestamp for display
   * @param {Timestamp} timestamp - Firestore timestamp
   * @returns {string} Formatted date string
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  /**
   * Format full timestamp
   * @param {Timestamp} timestamp - Firestore timestamp
   * @returns {string} Formatted date string
   */
  formatFullTimestamp(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Export singleton instance
const messagingSystem = new MessagingSystem();
export default messagingSystem;
