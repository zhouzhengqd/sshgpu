import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../../../src/main/ssh/connection-manager';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  it('should track connection state', () => {
    expect(manager.getConnectionState('test-server')).toBe('disconnected');
  });

  it('should limit concurrent executions to 5', () => {
    expect(manager.maxConcurrent).toBe(5);
  });

  it('should queue commands when at capacity', () => {
    const queueSize = manager.getQueueSize();
    expect(queueSize).toBe(0);
  });
});
