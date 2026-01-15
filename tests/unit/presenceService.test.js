/**
 * Unit tests for PresenceService
 */

const { PresenceService, PRESENCE_STATES } = require('../../services/presenceService');

describe('PresenceService', () => {
  let presenceService;

  beforeEach(() => {
    // Use in-memory storage (no Redis for tests)
    presenceService = new PresenceService(null);
  });

  afterEach(() => {
    presenceService.destroy();
  });

  describe('User Online/Offline Status', () => {
    it('should set user as online', async () => {
      await presenceService.setOnline('user1', 'socket1');

      const presence = await presenceService.getPresence('user1');

      expect(presence.state).toBe(PRESENCE_STATES.ONLINE);
      expect(presence.lastSeen).toBeDefined();
    });

    it('should set user as offline', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOffline('user1', 'socket1');

      const presence = await presenceService.getPresence('user1');

      expect(presence.state).toBe(PRESENCE_STATES.OFFLINE);
    });

    it('should keep user online with multiple sockets', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOnline('user1', 'socket2');
      await presenceService.setOffline('user1', 'socket1');

      const presence = await presenceService.getPresence('user1');

      expect(presence.state).toBe(PRESENCE_STATES.ONLINE);
    });

    it('should set user offline when all sockets disconnect', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOnline('user1', 'socket2');
      await presenceService.setOffline('user1', 'socket1');
      await presenceService.setOffline('user1', 'socket2');

      const presence = await presenceService.getPresence('user1');

      expect(presence.state).toBe(PRESENCE_STATES.OFFLINE);
    });
  });

  describe('Heartbeat', () => {
    it('should update last seen on heartbeat', async () => {
      await presenceService.setOnline('user1', 'socket1');

      const presence1 = await presenceService.getPresence('user1');
      const initialLastSeen = presence1.lastSeen;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await presenceService.heartbeat('user1');

      const presence2 = await presenceService.getPresence('user1');

      expect(presence2.lastSeen).toBeGreaterThan(initialLastSeen);
    });

    it('should bring user back to online from away', async () => {
      await presenceService.setOnline('user1', 'socket1');

      // Manually set to away
      const presence = presenceService.presenceMap.get('user1');
      presence.state = PRESENCE_STATES.AWAY;

      await presenceService.heartbeat('user1');

      const updatedPresence = await presenceService.getPresence('user1');
      expect(updatedPresence.state).toBe(PRESENCE_STATES.ONLINE);
    });
  });

  describe('Bulk Presence', () => {
    it('should get presence for multiple users', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOnline('user2', 'socket2');

      const presence = await presenceService.getBulkPresence(['user1', 'user2', 'user3']);

      expect(presence.user1.state).toBe(PRESENCE_STATES.ONLINE);
      expect(presence.user2.state).toBe(PRESENCE_STATES.ONLINE);
      expect(presence.user3.state).toBe(PRESENCE_STATES.OFFLINE);
    });
  });

  describe('Online Users', () => {
    it('should get list of online users', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOnline('user2', 'socket2');
      await presenceService.setOnline('user3', 'socket3');

      const onlineUsers = await presenceService.getOnlineUsers();

      expect(onlineUsers).toHaveLength(3);
      expect(onlineUsers).toContain('user1');
      expect(onlineUsers).toContain('user2');
      expect(onlineUsers).toContain('user3');
    });

    it('should get online users count', async () => {
      await presenceService.setOnline('user1', 'socket1');
      await presenceService.setOnline('user2', 'socket2');

      const count = await presenceService.getOnlineCount();

      expect(count).toBe(2);
    });

    it('should return empty list when no users online', async () => {
      const onlineUsers = await presenceService.getOnlineUsers();

      expect(onlineUsers).toHaveLength(0);
    });
  });

  describe('isOnline', () => {
    it('should return true for online user', async () => {
      await presenceService.setOnline('user1', 'socket1');

      const isOnline = await presenceService.isOnline('user1');

      expect(isOnline).toBe(true);
    });

    it('should return false for offline user', async () => {
      const isOnline = await presenceService.isOnline('user1');

      expect(isOnline).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('should return offline for unknown user', async () => {
      const presence = await presenceService.getPresence('unknown');

      expect(presence.state).toBe(PRESENCE_STATES.OFFLINE);
      expect(presence.lastSeen).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup stale presence records', async () => {
      await presenceService.setOnline('user1', 'socket1');

      // Manually set last seen to old timestamp
      const presence = presenceService.presenceMap.get('user1');
      presence.lastSeen = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      await presenceService.cleanup();

      expect(presenceService.presenceMap.has('user1')).toBe(false);
    });

    it('should not cleanup recent presence records', async () => {
      await presenceService.setOnline('user1', 'socket1');

      await presenceService.cleanup();

      expect(presenceService.presenceMap.has('user1')).toBe(true);
    });
  });

  describe('State Transitions', () => {
    it('should transition online -> away -> offline based on inactivity', async () => {
      await presenceService.setOnline('user1', 'socket1');

      // Online state
      let presence = await presenceService.getPresence('user1');
      expect(presence.state).toBe(PRESENCE_STATES.ONLINE);

      // Simulate 6 minutes of inactivity (away threshold)
      const presenceData = presenceService.presenceMap.get('user1');
      presenceData.lastSeen = Date.now() - 6 * 60 * 1000;

      presence = await presenceService.getPresence('user1');
      expect(presence.state).toBe(PRESENCE_STATES.AWAY);

      // Simulate 16 minutes of inactivity (offline threshold)
      presenceData.lastSeen = Date.now() - 16 * 60 * 1000;

      presence = await presenceService.getPresence('user1');
      expect(presence.state).toBe(PRESENCE_STATES.OFFLINE);
    });
  });
});
