import { Server } from '@shared/types';

export interface SSHConfigEntry {
  host: string;
  hostname: string;
  user: string;
  port: number;
  identityFile?: string;
  proxyJump?: string;
}

export function parseSSHConfig(content: string): SSHConfigEntry[] {
  const entries: SSHConfigEntry[] = [];
  let current: Partial<SSHConfigEntry> | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const hostMatch = line.match(/^Host\s+(.+)$/i);
    if (hostMatch) {
      if (current?.host && current.host !== '*') {
        entries.push(finalizeEntry(current));
      }
      const hostValue = hostMatch[1].trim();
      current = hostValue === '*' ? null : { host: hostValue };
      continue;
    }

    if (!current) continue;

    const [key, ...valueParts] = line.split(/\s+/);
    const value = valueParts.join(' ');
    const lowerKey = key.toLowerCase();

    switch (lowerKey) {
      case 'hostname':
        current.hostname = value;
        break;
      case 'user':
        current.user = value;
        break;
      case 'port':
        current.port = parseInt(value, 10);
        break;
      case 'identityfile':
        current.identityFile = value;
        break;
      case 'proxyjump':
        current.proxyJump = value;
        break;
    }
  }

  if (current?.host && current.host !== '*') {
    entries.push(finalizeEntry(current));
  }

  return entries;
}

function finalizeEntry(entry: Partial<SSHConfigEntry>): SSHConfigEntry {
  return {
    host: entry.host!,
    hostname: entry.hostname || entry.host!,
    user: entry.user || process.env.USER || 'root',
    port: entry.port || 22,
    identityFile: entry.identityFile,
    proxyJump: entry.proxyJump,
  };
}

export function getServerList(entries: SSHConfigEntry[]): Server[] {
  return entries.map((entry) => ({
    id: entry.host,
    name: entry.host,
    host: entry.hostname,
    port: entry.port,
    user: entry.user,
    source: 'ssh-config' as const,
    jumpHost: entry.proxyJump,
    status: 'offline' as const,
    lastUpdated: null,
  }));
}
