import { dialog } from 'electron';
import fs from 'fs';
import { ServerWithStatus, TaskHistoryEntry } from '@shared/types';

export async function exportToJson(data: unknown, defaultFilename: string): Promise<void> {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

export async function exportToCsv(rows: Record<string, unknown>[], defaultFilename: string): Promise<void> {
  if (rows.length === 0) return;
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (filePath) {
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map((row) =>
      Object.values(row)
        .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v)))
        .join(',')
    );
    fs.writeFileSync(filePath, [headers, ...lines].join('\n'));
  }
}

export function prepareGpuExportData(servers: ServerWithStatus[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const server of servers) {
    if (!server.statusData) continue;
    for (const gpu of server.statusData.gpu) {
      rows.push({
        server: server.name,
        serverId: server.id,
        gpuIndex: gpu.index,
        gpuName: gpu.name,
        utilization: gpu.utilization,
        memoryUsed: gpu.memoryUsed,
        memoryTotal: gpu.memoryTotal,
        temperature: gpu.temperature,
        processCount: gpu.processes.length,
        idleSince: gpu.idleSince?.toISOString() || '',
      });
    }
  }
  return rows;
}

export function prepareTaskHistoryExportData(history: TaskHistoryEntry[]): Record<string, unknown>[] {
  return history.map((entry) => ({
    id: entry.id,
    user: entry.user,
    name: entry.name,
    startTime: entry.startTime,
    endTime: entry.endTime,
    duration: entry.duration,
    state: entry.state,
    serverId: entry.serverId,
  }));
}
