import { Server } from '@shared/types';
import { spawn } from 'child_process';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class ConnectionManager {
  private connectedServers = new Set<string>();
  private states = new Map<string, ConnectionState>();
  private serverHosts = new Map<string, { host: string; port: number; user: string; identityFile?: string }>();
  private executionQueue: Array<{ resolve: () => void }> = [];
  private runningExecutions = 0;
  readonly maxConcurrent = 5;

  getConnectionState(serverId: string): ConnectionState {
    return this.states.get(serverId) || 'disconnected';
  }

  getQueueSize(): number {
    return this.executionQueue.length;
  }

  private buildSshArgs(hostInfo: { host: string; port: number; user: string; identityFile?: string }, command?: string): string[] {
    const args: string[] = [
      '-o', 'ConnectTimeout=5',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'BatchMode=yes',
      '-p', String(hostInfo.port),
    ];
    if (hostInfo.identityFile) {
      args.push('-i', hostInfo.identityFile);
    }
    args.push(`${hostInfo.user}@${hostInfo.host}`);
    if (command) {
      args.push(command);
    }
    return args;
  }

  private runSsh(hostInfo: { host: string; port: number; user: string; identityFile?: string }, command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildSshArgs(hostInfo, command);
      const child = spawn('ssh', args, { timeout });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data: Buffer) => (stdout += data.toString()));
      child.stderr.on('data', (data: Buffer) => (stderr += data.toString()));

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`SSH failed (exit ${code}): ${stderr.trim()}`));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (err) => {
        reject(new Error(`SSH spawn error: ${err.message}`));
      });
    });
  }

  async connect(server: Server, identityFile?: string): Promise<void> {
    this.states.set(server.id, 'connecting');

    const hostInfo = {
      host: server.host,
      port: server.port,
      user: server.user,
      identityFile: identityFile || server.identityFile,
    };
    this.serverHosts.set(server.id, hostInfo);

    try {
      const stdout = await this.runSsh(hostInfo, 'echo ok', 8000);
      if (stdout.trim() !== 'ok') {
        this.states.set(server.id, 'error');
        throw new Error('SSH test failed');
      }
      this.connectedServers.add(server.id);
      this.states.set(server.id, 'connected');
    } catch (err) {
      this.states.set(server.id, 'error');
      throw err;
    }
  }

  async execute(serverId: string, command: string): Promise<string> {
    const state = this.states.get(serverId);
    if (state !== 'connected') {
      throw new Error(`Not connected to ${serverId}`);
    }

    const hostInfo = this.serverHosts.get(serverId);
    if (!hostInfo) {
      throw new Error(`No host info for ${serverId}`);
    }

    await this.acquireSlot();

    try {
      const stdout = await this.runSsh(hostInfo, command, 30000);
      return stdout;
    } finally {
      this.releaseSlot();
    }
  }

  async disconnect(serverId: string): Promise<void> {
    this.connectedServers.delete(serverId);
    this.states.set(serverId, 'disconnected');
    this.serverHosts.delete(serverId);
  }

  async disconnectAll(): Promise<void> {
    this.connectedServers.clear();
    this.serverHosts.clear();
    this.states.clear();
  }

  storeServerHost(server: Server): void {
    this.serverHosts.set(server.id, {
      host: server.host,
      port: server.port,
      user: server.user,
    });
  }

  private async acquireSlot(): Promise<void> {
    if (this.runningExecutions < this.maxConcurrent) {
      this.runningExecutions++;
      return;
    }

    return new Promise((resolve) => {
      this.executionQueue.push({ resolve });
    });
  }

  private releaseSlot(): void {
    const next = this.executionQueue.shift();
    if (next) {
      next.resolve();
    } else {
      this.runningExecutions--;
    }
  }
}
