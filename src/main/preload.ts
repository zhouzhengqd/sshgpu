import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  refreshServer: (id: string) => ipcRenderer.invoke('refresh-server', id),
  refreshAll: () => ipcRenderer.invoke('refresh-all'),
  addServer: (config: any) => ipcRenderer.invoke('add-server', config),
  updateServer: (config: any) => ipcRenderer.invoke('update-server', config),
  deleteServer: (id: string) => ipcRenderer.invoke('delete-server', id),
  openTerminal: (serverId: string) => ipcRenderer.invoke('open-terminal', serverId),
  submitJob: (serverId: string, templateId: string) => ipcRenderer.invoke('submit-job', serverId, templateId),
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: any) => ipcRenderer.invoke('update-config', config),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  disableServer: (id: string) => ipcRenderer.invoke('disable-server', id),
  getTaskHistory: (serverId: string) => ipcRenderer.invoke('get-task-history', serverId),
  getUtilizationHistory: (serverId: string) => ipcRenderer.invoke('get-utilization-history', serverId),
  exportGpuData: (format: 'json' | 'csv') => ipcRenderer.invoke('export-gpu-data', format),
  exportTaskHistory: (serverId: string, format: 'json' | 'csv') => ipcRenderer.invoke('export-task-history', serverId, format),
  onServersUpdated: (callback: (servers: any) => void) => {
    ipcRenderer.on('servers-updated', (_event, servers) => callback(servers));
    return () => ipcRenderer.removeAllListeners('servers-updated');
  },
});
