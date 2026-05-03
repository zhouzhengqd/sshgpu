import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../../src/main/store';
import { Server, ServerStatus, ServerWithStatus } from '../../src/shared/types';

describe('DataStore', () => {
  let store: DataStore;

  beforeEach(() => {
    store = new DataStore();
  });

  it('should add and retrieve servers', () => {
    const server: Server = {
      id: 'test-1',
      name: 'Test Server',
      host: '10.0.0.1',
      port: 22,
      user: 'admin',
      source: 'manual',
      status: 'offline',
      lastUpdated: null,
    };

    store.addServer(server);
    expect(store.getServer('test-1')).toEqual(server);
    expect(store.getAllServers()).toHaveLength(1);
  });

  it('should update server status', () => {
    const server: Server = {
      id: 'test-1',
      name: 'Test Server',
      host: '10.0.0.1',
      port: 22,
      user: 'admin',
      source: 'manual',
      status: 'offline',
      lastUpdated: null,
    };
    store.addServer(server);

    const status: ServerStatus = {
      gpu: [{ index: 0, name: 'A100', memoryUsed: 1024, memoryTotal: 81920, utilization: 45, temperature: 62, processes: [], idleSince: null }],
      cpu: { usage: 23, cores: 8 },
      memory: { used: 64000, total: 128000, percent: 50 },
      disk: { used: '200G', total: '500G', percent: 40 },
      network: { rx: '1 GB', tx: '500 MB', latency: 1.2 },
      tasks: [],
      environment: { condaEnvs: ['base', 'py39'], modules: ['cuda/11.8'] },
    };

    store.updateServerStatus('test-1', status);
    const serverWithStatus = store.getServerWithStatus('test-1');
    expect(serverWithStatus?.statusData).toEqual(status);
    expect(serverWithStatus?.status).toBe('online');
  });

  it('should remove server', () => {
    const server: Server = {
      id: 'test-1',
      name: 'Test Server',
      host: '10.0.0.1',
      port: 22,
      user: 'admin',
      source: 'manual',
      status: 'offline',
      lastUpdated: null,
    };
    store.addServer(server);
    store.removeServer('test-1');
    expect(store.getServer('test-1')).toBeUndefined();
  });

  it('should get all servers with status', () => {
    store.addServer({
      id: 's1', name: 'S1', host: '10.0.0.1', port: 22, user: 'a',
      source: 'manual', status: 'offline', lastUpdated: null,
    });
    store.addServer({
      id: 's2', name: 'S2', host: '10.0.0.2', port: 22, user: 'b',
      source: 'ssh-config', status: 'offline', lastUpdated: null,
    });

    const all = store.getAllServersWithStatus();
    expect(all).toHaveLength(2);
    expect(all[0].statusData).toBeNull();
  });
});
