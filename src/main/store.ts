import { Server, ServerStatus, ServerWithStatus } from '@shared/types';

export class DataStore {
  private servers = new Map<string, Server>();
  private statusData = new Map<string, ServerStatus>();

  addServer(server: Server): void {
    this.servers.set(server.id, server);
  }

  getServer(id: string): Server | undefined {
    return this.servers.get(id);
  }

  getAllServers(): Server[] {
    return Array.from(this.servers.values());
  }

  removeServer(id: string): void {
    this.servers.delete(id);
    this.statusData.delete(id);
  }

  updateServerStatus(id: string, status: ServerStatus): void {
    const server = this.servers.get(id);
    if (!server) return;

    this.statusData.set(id, status);
    server.status = 'online';
    server.lastUpdated = new Date();
  }

  setServerOffline(id: string): void {
    const server = this.servers.get(id);
    if (server) {
      server.status = 'offline';
    }
  }

  setServerError(id: string): void {
    const server = this.servers.get(id);
    if (server) {
      server.status = 'error';
    }
  }

  getServerWithStatus(id: string): ServerWithStatus | undefined {
    const server = this.servers.get(id);
    if (!server) return undefined;

    return {
      ...server,
      statusData: this.statusData.get(id) || null,
    };
  }

  getAllServersWithStatus(): ServerWithStatus[] {
    return Array.from(this.servers.values()).map((server) => ({
      ...server,
      statusData: this.statusData.get(server.id) || null,
    }));
  }
}
