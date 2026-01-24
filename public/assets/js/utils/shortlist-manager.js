/**
 * Shortlist Manager
 * Manages shortlist state with localStorage fallback and server sync
 */

class ShortlistManager {
  constructor() {
    this.items = [];
    this.listeners = [];
    this.isAuthenticated = false;
    this.isSyncing = false;
    this.init();
  }

  /**
   * Get CSRF token from cookie
   */
  getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf') {
        return value;
      }
    }
    return null;
  }

  /**
   * Add CSRF token to fetch options
   */
  addCsrfHeaders(headers = {}) {
    const token = this.getCsrfToken();
    return token ? { ...headers, 'X-CSRF-Token': token } : headers;
  }

  /**
   * Initialize shortlist manager
   */
  async init() {
    // Check authentication
    this.isAuthenticated = await this.checkAuth();

    if (this.isAuthenticated) {
      // Load from server
      await this.loadFromServer();
    } else {
      // Load from localStorage
      this.loadFromLocalStorage();
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    try {
      // Try common auth endpoints
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) return true;
      
      // Fallback to /api/user endpoint
      const fallbackResponse = await fetch('/api/user', {
        credentials: 'include',
      });
      return fallbackResponse.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load shortlist from server
   */
  async loadFromServer() {
    try {
      const response = await fetch('/api/shortlist', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        this.items = data.data.items || [];
        
        // Merge with localStorage if present (auto-merge on login)
        await this.mergeLocalStorageOnLogin();
        
        this.saveToLocalStorage();
        this.notifyListeners();
      } else if (response.status === 401) {
        // User not authenticated - fail silently, use localStorage
        this.loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Failed to load shortlist from server:', error);
      this.loadFromLocalStorage();
    }
  }

  /**
   * Merge localStorage items into server on login (one-time operation)
   */
  async mergeLocalStorageOnLogin() {
    try {
      // Check if we've already merged (flag in localStorage)
      const mergeKey = 'eventflow_shortlist_merged';
      if (localStorage.getItem(mergeKey)) {
        return; // Already merged
      }

      // Get items from localStorage
      const stored = localStorage.getItem('eventflow_shortlist');
      if (!stored) {
        // No local items to merge
        localStorage.setItem(mergeKey, 'true');
        return;
      }

      const localData = JSON.parse(stored);
      const localItems = localData.items || [];

      if (localItems.length === 0) {
        localStorage.setItem(mergeKey, 'true');
        return;
      }

      // Merge local items into server (skip duplicates)
      const existingIds = new Set(
        this.items.map(item => `${item.type}:${item.id}`)
      );

      for (const item of localItems) {
        const itemKey = `${item.type}:${item.id}`;
        if (!existingIds.has(itemKey)) {
          // Add new item to server
          await this.addItem(item);
        }
      }

      // Mark as merged
      localStorage.setItem(mergeKey, 'true');
    } catch (error) {
      console.error('Failed to merge localStorage on login:', error);
    }
  }

  /**
   * Load shortlist from localStorage
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('eventflow_shortlist');
      if (stored) {
        const data = JSON.parse(stored);
        this.items = data.items || [];
      }
    } catch (error) {
      console.error('Failed to load shortlist from localStorage:', error);
      this.items = [];
    }
  }

  /**
   * Save shortlist to localStorage
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem('eventflow_shortlist', JSON.stringify({
        items: this.items,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to save shortlist to localStorage:', error);
    }
  }

  /**
   * Add item to shortlist
   */
  async addItem(item) {
    // Check if already exists
    const exists = this.items.some(i => i.type === item.type && i.id === item.id);
    if (exists) {
      return { success: false, error: 'Item already in shortlist' };
    }

    // Add to local state
    this.items.push({
      ...item,
      addedAt: new Date().toISOString(),
    });

    // Save to localStorage
    this.saveToLocalStorage();

    // Sync to server if authenticated
    if (this.isAuthenticated) {
      try {
        const response = await fetch('/api/shortlist', {
          method: 'POST',
          headers: this.addCsrfHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify(item),
        });

        if (!response.ok) {
          // Rollback on server error
          this.items = this.items.filter(i => !(i.type === item.type && i.id === item.id));
          this.saveToLocalStorage();
          return { success: false, error: 'Failed to sync to server' };
        }
      } catch (error) {
        console.error('Failed to sync shortlist add to server:', error);
      }
    }

    this.notifyListeners();
    return { success: true };
  }

  /**
   * Remove item from shortlist
   */
  async removeItem(type, id) {
    // Remove from local state
    this.items = this.items.filter(i => !(i.type === type && i.id === id));

    // Save to localStorage
    this.saveToLocalStorage();

    // Sync to server if authenticated
    if (this.isAuthenticated) {
      try {
        await fetch(`/api/shortlist/${type}/${id}`, {
          method: 'DELETE',
          headers: this.addCsrfHeaders({}),
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to sync shortlist remove to server:', error);
      }
    }

    this.notifyListeners();
    return { success: true };
  }

  /**
   * Clear entire shortlist
   */
  async clearAll() {
    this.items = [];
    this.saveToLocalStorage();

    if (this.isAuthenticated) {
      try {
        await fetch('/api/shortlist', {
          method: 'DELETE',
          headers: this.addCsrfHeaders({}),
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to sync shortlist clear to server:', error);
      }
    }

    this.notifyListeners();
    return { success: true };
  }

  /**
   * Check if item is in shortlist
   */
  hasItem(type, id) {
    return this.items.some(i => i.type === type && i.id === id);
  }

  /**
   * Get all items
   */
  getItems() {
    return [...this.items];
  }

  /**
   * Get items count
   */
  getCount() {
    return this.items.length;
  }

  /**
   * Register change listener
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.items);
      } catch (error) {
        console.error('Shortlist listener error:', error);
      }
    });
  }
}

// Export singleton instance
const shortlistManager = new ShortlistManager();
export default shortlistManager;
