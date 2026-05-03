import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdleNotifier } from '../../src/main/notifier';

describe('IdleNotifier', () => {
  let notifier: IdleNotifier;

  beforeEach(() => {
    notifier = new IdleNotifier(30); // 30 min threshold
  });

  it('should track idle GPUs', () => {
    const gpu = {
      index: 0,
      name: 'A100',
      memoryUsed: 0,
      memoryTotal: 81920,
      utilization: 0,
      temperature: 40,
      processes: [],
      idleSince: null,
    };

    const result = notifier.checkGpu('server-1', gpu);
    expect(result.idleSince).toBeInstanceOf(Date);
  });

  it('should reset idle time when GPU becomes active', () => {
    const idleGpu = {
      index: 0, name: 'A100', memoryUsed: 0, memoryTotal: 81920,
      utilization: 0, temperature: 40, processes: [], idleSince: new Date(),
    };
    const activeGpu = {
      index: 0, name: 'A100', memoryUsed: 50000, memoryTotal: 81920,
      utilization: 80, temperature: 70, processes: [], idleSince: null,
    };

    notifier.checkGpu('server-1', idleGpu);
    const result = notifier.checkGpu('server-1', activeGpu);
    expect(result.idleSince).toBeNull();
  });

  it('should determine if notification should be sent', () => {
    const recentIdle = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const oldIdle = new Date(Date.now() - 35 * 60 * 1000);    // 35 min ago

    expect(notifier.shouldNotify(recentIdle)).toBe(false);
    expect(notifier.shouldNotify(oldIdle)).toBe(true);
  });

  it('should not notify during quiet hours', () => {
    notifier.setQuietHours('22:00', '08:00');
    expect(notifier.quietHoursStart).toBe('22:00');
    expect(notifier.quietHoursEnd).toBe('08:00');
  });
});
