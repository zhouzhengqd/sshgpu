import { ipcMain } from 'electron';
import { DataStore } from './store';
import { DataCollector } from './collector';
import { HistoryStore } from './history-store';
import { ConnectionManager } from './ssh/connection-manager';
import { UtilizationHistory } from './utilization-history';
import { IdleNotifier } from './notifier';
import { exportToJson, exportToCsv, prepareGpuExportData, prepareTaskHistoryExportData } from './export';
import { ManualServerConfig, AppConfig } from '@shared/types';
import { spawn } from 'child_process';
import Store from 'electron-store';

export function registerIpcHandlers(
  dataStore: DataStore,
  collector: DataCollector,
  connectionManager: ConnectionManager,
  configStore: Store<AppConfig>,
  historyStore: HistoryStore,
  createSettingsWindow: () => void,
  reloadServers?: () => Promise<void>,
  utilizationHistory?: UtilizationHistory,
  notifier?: IdleNotifier
): void {
  ipcMain.handle('get-servers', () => {
    return dataStore.getAllServersWithStatus();
  });

  ipcMain.handle('refresh-server', async (_event, serverId: string) => {
    const server = dataStore.getServer(serverId);
    if (server) {
      await collector.collectServer(server);
    }
  });

  ipcMain.handle('refresh-all', async () => {
    if (reloadServers) {
      await reloadServers();
    }
    await collector.collectAll();
  });

  ipcMain.handle('add-server', async (_event, config: ManualServerConfig) => {
    const server = {
      ...config,
      source: 'manual' as const,
      status: 'offline' as const,
      lastUpdated: null,
    };
    dataStore.addServer(server);
    connectionManager.storeServerHost(server);

    const servers = configStore.get('servers', []);
    servers.push(config);
    configStore.set('servers', servers);

    try {
      await connectionManager.connect(server, config.identityFile);
    } catch (err) {
      // Connection will be retried
    }
  });

  ipcMain.handle('update-server', async (_event, config: ManualServerConfig) => {
    const existing = dataStore.getServer(config.id);
    if (existing) {
      dataStore.addServer({ ...existing, ...config });
    }

    const servers = configStore.get('servers', []);
    const index = servers.findIndex((s) => s.id === config.id);
    if (index >= 0) {
      servers[index] = config;
      configStore.set('servers', servers);
    }
  });

  ipcMain.handle('delete-server', async (_event, serverId: string) => {
    await connectionManager.disconnect(serverId);
    dataStore.removeServer(serverId);
    collector.removeServer(serverId);
    utilizationHistory?.removeServer(serverId);

    const servers = configStore.get('servers', []);
    configStore.set('servers', servers.filter((s) => s.id !== serverId));
  });

  ipcMain.handle('open-terminal', async (_event, serverId: string) => {
    const server = dataStore.getServer(serverId);
    if (!server) return;

    const terminalApp = configStore.get('terminalApp', 'Terminal.app');
    const sshCommand = `ssh ${shellQuote(`${server.user}@${server.host}`)} -p ${shellQuote(String(server.port))}`;

    if (terminalApp === 'iTerm2') {
      runAppleScript(`tell application "iTerm2" to create window with default profile command ${appleScriptString(sshCommand)}`);
    } else {
      runAppleScript(`tell application "Terminal" to do script ${appleScriptString(sshCommand)}`);
      runAppleScript('tell application "Terminal" to activate');
    }
  });

  ipcMain.handle('submit-job', async (_event, serverId: string, templateId: string) => {
    const server = dataStore.getServer(serverId);
    const templates = configStore.get('taskTemplates', []);
    const template = templates.find((t) => t.id === templateId);

    if (!server || !template) return;

    try {
      const args = template.defaultArgs
        ? template.defaultArgs.split(/\s+/).filter(Boolean).map(shellQuote).join(' ')
        : '';
      await connectionManager.execute(serverId, `printf %s ${shellQuote(template.script)} | sbatch ${args}`);
    } catch (err) {
      console.error('Failed to submit job:', err);
    }
  });

  ipcMain.handle('get-config', () => {
    return configStore.store;
  });

  ipcMain.handle('update-config', async (_event, updates: Partial<AppConfig>) => {
    for (const [key, value] of Object.entries(updates)) {
      configStore.set(key, value);
    }

    if (updates.pollingInterval) {
      collector.updateInterval(updates.pollingInterval);
    }
    if (updates.idleThreshold && notifier) {
      notifier.setThreshold(updates.idleThreshold);
    }
    if (updates.idleUtilizationThreshold !== undefined && notifier) {
      notifier.setUtilizationThreshold(updates.idleUtilizationThreshold);
    }
  });

  ipcMain.handle('open-settings', () => {
    createSettingsWindow();
  });

  ipcMain.handle('disable-server', async (_event, serverId: string) => {
    await connectionManager.disconnect(serverId);
    dataStore.removeServer(serverId);
    collector.removeServer(serverId);
    utilizationHistory?.removeServer(serverId);
  });

  ipcMain.handle('get-task-history', (_event, serverId: string) => {
    return historyStore.getHistory(serverId);
  });

  ipcMain.handle('get-utilization-history', (_event, serverId: string) => {
    if (!utilizationHistory) return {};
    return utilizationHistory.getHistoriesForServer(serverId);
  });

  ipcMain.handle('export-gpu-data', async (_event, format: 'json' | 'csv') => {
    const servers = dataStore.getAllServersWithStatus();
    const data = prepareGpuExportData(servers);
    if (format === 'json') {
      await exportToJson(data, 'sshgpu-gpu-data.json');
    } else {
      await exportToCsv(data, 'sshgpu-gpu-data.csv');
    }
  });

  ipcMain.handle('export-task-history', async (_event, serverId: string, format: 'json' | 'csv') => {
    const history = historyStore.getHistory(serverId);
    if (format === 'json') {
      await exportToJson(history, `sshgpu-task-history-${serverId}.json`);
    } else {
      await exportToCsv(prepareTaskHistoryExportData(history), `sshgpu-task-history-${serverId}.csv`);
    }
  });
}

function runAppleScript(script: string): void {
  const child = spawn('osascript', ['-e', script], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptString(value: string): string {
  return JSON.stringify(value);
}
