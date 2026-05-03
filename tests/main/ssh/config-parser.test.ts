import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSSHConfig, getServerList } from '../../../src/main/ssh/config-parser';

describe('parseSSHConfig', () => {
  it('should parse a simple SSH config', () => {
    const config = `
Host gpu-server-1
  HostName 192.168.1.100
  User admin
  Port 22
  IdentityFile ~/.ssh/id_rsa

Host gpu-server-2
  HostName 10.0.0.50
  User researcher
  Port 2222
`;
    const result = parseSSHConfig(config);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      host: 'gpu-server-1',
      hostname: '192.168.1.100',
      user: 'admin',
      port: 22,
      identityFile: '~/.ssh/id_rsa',
    });
    expect(result[1]).toEqual({
      host: 'gpu-server-2',
      hostname: '10.0.0.50',
      user: 'researcher',
      port: 2222,
    });
  });

  it('should parse ProxyJump directive', () => {
    const config = `
Host jump-server
  HostName 10.0.0.1
  User admin

Host internal-server
  HostName 192.168.1.100
  ProxyJump jump-server
  User researcher
`;
    const result = parseSSHConfig(config);
    expect(result[1].proxyJump).toBe('jump-server');
  });

  it('should handle Host * wildcard by skipping it', () => {
    const config = `
Host *
  ServerAliveInterval 60

Host my-server
  HostName 10.0.0.1
`;
    const result = parseSSHConfig(config);
    expect(result).toHaveLength(1);
    expect(result[0].host).toBe('my-server');
  });

  it('should use host as hostname when HostName is not specified', () => {
    const config = `
Host my-server.example.com
  User admin
`;
    const result = parseSSHConfig(config);
    expect(result[0].hostname).toBe('my-server.example.com');
  });

  it('should default port to 22', () => {
    const config = `
Host my-server
  HostName 10.0.0.1
`;
    const result = parseSSHConfig(config);
    expect(result[0].port).toBe(22);
  });
});

describe('getServerList', () => {
  it('should convert SSH config entries to Server objects', () => {
    const entries = [
      { host: 'gpu-1', hostname: '10.0.0.1', user: 'admin', port: 22 },
      { host: 'gpu-2', hostname: '10.0.0.2', user: 'researcher', port: 22 },
    ];
    const result = getServerList(entries);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'gpu-1',
      name: 'gpu-1',
      host: '10.0.0.1',
      user: 'admin',
      port: 22,
      source: 'ssh-config',
      status: 'offline',
    });
  });
});
