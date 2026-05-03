import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataCollector } from '../../src/main/collector';

describe('DataCollector', () => {
  it('should build collection commands', () => {
    const collector = new DataCollector(null as any, null as any, null as any);
    const commands = collector.buildCommands();
    expect(commands).toContainEqual(
      expect.objectContaining({ name: 'gpu', command: expect.stringContaining('nvidia-smi') })
    );
    expect(commands).toContainEqual(
      expect.objectContaining({ name: 'cpu', command: expect.stringContaining('top') })
    );
  });

  it('should build commands with custom commands', () => {
    const collector = new DataCollector(null as any, null as any, null as any);
    const custom = [{ id: 'c1', name: 'uptime', command: 'uptime' }];
    const commands = collector.buildCommands(custom);
    expect(commands).toContainEqual(
      expect.objectContaining({ name: 'uptime', command: 'uptime' })
    );
  });
});
