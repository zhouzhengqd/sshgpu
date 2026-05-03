// src/main/index.ts
import { app, BrowserWindow, Notification } from 'electron';
import { TrayManager } from './tray';
import { PopoverWindow } from './window';
import { ConnectionManager } from './ssh/connection-manager';
import { DataStore } from './store';
import { DataCollector } from './collector';
import { HistoryStore } from './history-store';
import { IdleNotifier } from './notifier';
import { UtilizationHistory } from './utilization-history';
import { sendDingtalkMessage, formatGpuIdleMessage } from './dingtalk';
import { registerIpcHandlers } from './ipc';
import { parseSSHConfig, getServerList } from './ssh/config-parser';
import Store from 'electron-store';
import { AppConfig, Server, TaskHistoryEntry } from '@shared/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let trayManager: TrayManager;
let popoverWindow: PopoverWindow;
let connectionManager: ConnectionManager;
let dataStore: DataStore;
let collector: DataCollector;
let historyStore: HistoryStore;
let notifier: IdleNotifier;
let utilizationHistory: UtilizationHistory;
let configStore: Store<AppConfig>;
let sshConfigWatcher: (() => void) | null = null;

function getSSHConfigPath(): string {
  return path.join(os.homedir(), '.ssh', 'config');
}

function loadSSHConfigServers(): Server[] {
  try {
    const configPath = getSSHConfigPath();
    if (!fs.existsSync(configPath)) return [];

    const content = fs.readFileSync(configPath, 'utf-8');
    const entries = parseSSHConfig(content);
    return getServerList(entries);
  } catch (err) {
    console.error('Failed to parse SSH config:', err);
    return [];
  }
}

function loadManualServers(): Server[] {
  const configs = configStore.get('servers', []);
  return configs.map((config) => ({
    ...config,
    source: 'manual' as const,
    status: 'offline' as const,
    lastUpdated: null,
  }));
}

function createSettingsWindow(): BrowserWindow {
  const settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    title: 'SSHGPU Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.VITE_DEV_PORT || '5173';
    settingsWindow.loadURL(`http://localhost:${port}/settings.html`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  }

  return settingsWindow;
}

async function initializeApp(): Promise<void> {
  // Initialize config store
  configStore = new Store<AppConfig>({
    defaults: {
      servers: [],
      disabledServerIds: [],
      pollingInterval: 120,
      idleThreshold: 30,
      notificationEnabled: true,
      terminalApp: 'Terminal.app',
    },
  });

  // Initialize core components
  connectionManager = new ConnectionManager();
  dataStore = new DataStore();
  historyStore = new HistoryStore();
  utilizationHistory = new UtilizationHistory();
  notifier = new IdleNotifier(
    configStore.get('idleThreshold', 30),
    configStore.get('idleUtilizationThreshold', 5)
  );

  // Initialize collector
  collector = new DataCollector(connectionManager, dataStore, historyStore, {
    pollingInterval: configStore.get('pollingInterval', 120),
  });

  // Set up collection event handlers
  collector.on('status-updated', (serverId: string) => {
    const servers = dataStore.getAllServersWithStatus();

    // Update idle status and check for notifications only for the updated server
    const updatedServer = servers.find((s) => s.id === serverId);
    if (updatedServer?.statusData) {
      updatedServer.statusData.gpu = updatedServer.statusData.gpu.map((gpu) =>
        notifier.checkGpu(serverId, gpu)
      );

      for (const gpu of updatedServer.statusData.gpu) {
        if (notifier.shouldNotifyGpu(serverId, gpu)) {
          const memPercent = gpu.memoryTotal > 0 ? (gpu.memoryUsed / gpu.memoryTotal) * 100 : 100;
          const isMemoryFreed = memPercent < 10;
          const title = 'GPU Idle Alert';
          const body = `${updatedServer.name} GPU ${gpu.index} has been idle for ${notifier.getThreshold()} minutes`;

          try {
            new Notification({ title, body }).show();
          } catch {
            // Notification may not be available
          }

          // Send DingTalk webhook if configured and memory is also freed
          const webhook = configStore.get('dingtalkWebhook', '');
          if (webhook && isMemoryFreed) {
            const message = formatGpuIdleMessage(updatedServer.name, gpu, notifier.getThreshold());
            sendDingtalkMessage(webhook, message).catch((err) => {
              console.error('[DingTalk] Failed to send notification:', err.message);
            });
          }
        }
      }
    }

    // Track utilization history
    if (updatedServer?.statusData) {
      for (const gpu of updatedServer.statusData.gpu) {
        utilizationHistory.addPoint(serverId, gpu.index, gpu.utilization);
      }
    }

    // Update tray
    trayManager.setTitle(servers);
    trayManager.updateStatus(servers);

    // Send to renderer
    const window = popoverWindow.getWindow();
    if (window) {
      window.webContents.send('servers-updated', servers);
    }
  });

  // Task completion notification
  collector.on('task-completed', (serverId: string, entry: TaskHistoryEntry) => {
    if (!configStore.get('notificationEnabled', true)) return;

    const server = dataStore.getServer(serverId);
    const serverName = server?.name || serverId;
    const title = 'Task Completed';
    const body = `${entry.name} (PID ${entry.id}) on ${serverName}\nDuration: ${entry.duration}`;

    try {
      new Notification({ title, body }).show();
    } catch {
      // Notification may not be available
    }
  });

  // Create UI
  trayManager = new TrayManager();
  popoverWindow = new PopoverWindow();

  trayManager.create(() => {
    popoverWindow.toggle();
  });

  const window = popoverWindow.create();
  trayManager.setPopoverWindow(window);

  // Capture renderer console output
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'LOG';
    console.log(`[RENDERER ${prefix}] ${message} (${sourceId}:${line})`);
  });

  // Function to reload servers from SSH config and test connectivity
  async function reloadServers(): Promise<void> {
    console.log('[SSHGPU] Loading servers...');
    const sshServers = loadSSHConfigServers();
    const manualServers = loadManualServers();
    const allServers = [...sshServers, ...manualServers];
    console.log(`[SSHGPU] Found ${allServers.length} servers, testing connectivity...`);

    // Test connectivity to ALL servers
    const reachableIds = new Set<string>();
    const testPromises = allServers.map(async (server) => {
      connectionManager.storeServerHost(server);
      try {
        await connectionManager.connect(server);
        console.log(`[SSHGPU] ✓ ${server.name} connected`);
        reachableIds.add(server.id);
        dataStore.addServer(server);
      } catch (err) {
        console.log(`[SSHGPU] ✗ ${server.name} unreachable`);
        // Remove unreachable servers from store
        dataStore.removeServer(server.id);
        await connectionManager.disconnect(server.id);
      }
    });

    await Promise.allSettled(testPromises);

    const total = dataStore.getAllServers().length;
    console.log(`[SSHGPU] ${total} reachable servers in store`);
  }

  // Register IPC handlers
  registerIpcHandlers(dataStore, collector, connectionManager, configStore, historyStore, createSettingsWindow, reloadServers, utilizationHistory, notifier);

  // Load servers, test SSH connectivity, only keep reachable ones
  await reloadServers();

  // Start collection
  console.log('[SSHGPU] Starting data collection...');
  collector.start();

  // Watch SSH config for changes
  const sshConfigPath = getSSHConfigPath();
  if (fs.existsSync(sshConfigPath)) {
    const watcher = () => {
      const newServers = loadSSHConfigServers();
      const disabledIdsRefresh = new Set(configStore.get('disabledServerIds', []));
      for (const server of newServers) {
        if (disabledIdsRefresh.has(server.id)) continue;
        const existing = dataStore.getServer(server.id);
        if (!existing) {
          connectionManager.connect(server).then(() => {
            dataStore.addServer(server);
          }).catch(() => {});
        }
      }
    };
    sshConfigWatcher = watcher;
    fs.watchFile(sshConfigPath, { interval: 30000 }, watcher);
  }
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  // Keep running in tray on macOS
});

app.on('before-quit', () => {
  const sshConfigPath = getSSHConfigPath();
  if (sshConfigWatcher) {
    fs.unwatchFile(sshConfigPath, sshConfigWatcher);
    sshConfigWatcher = null;
  }
  collector.stop();
  connectionManager.disconnectAll();
  trayManager.destroy();
});
