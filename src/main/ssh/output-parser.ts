import { GPU, GPUProcess, Task, TaskHistoryEntry } from '@shared/types';

export function parseNvidiaSmi(output: string): GPU[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      return {
        index: parseInt(parts[0], 10),
        name: parts[1],
        memoryUsed: parseInt(parts[2], 10),
        memoryTotal: parseInt(parts[3], 10),
        utilization: parseInt(parts[4], 10),
        temperature: parseInt(parts[5], 10),
        uuid: parts[6]?.trim() || '',
        processes: [],
        idleSince: null,
      };
    });
}

export function parseGpuProcesses(output: string): Map<string, GPUProcess[]> {
  const map = new Map<string, GPUProcess[]>();
  if (!output.trim()) return map;

  for (const line of output.trim().split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((s) => s.trim());
    if (parts.length < 4) continue;
    const uuid = parts[0];
    const proc: GPUProcess = {
      pid: parseInt(parts[1], 10),
      name: parts[2],
      memoryUsed: parseInt(parts[3], 10),
    };
    if (!map.has(uuid)) map.set(uuid, []);
    map.get(uuid)!.push(proc);
  }
  return map;
}

export function parseFreeMemory(output: string): { used: number; total: number; percent: number } {
  const memLine = output.split('\n').find((line) => line.startsWith('Mem:'));
  if (!memLine) return { used: 0, total: 0, percent: 0 };

  const parts = memLine.split(/\s+/);
  const total = parseInt(parts[1], 10);
  const used = parseInt(parts[2], 10);
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;

  return { used, total, percent };
}

export function parseTopCpu(output: string): { usage: number; cores: number } {
  const cpuLine = output.split('\n').find((line) => line.includes('%Cpu'));
  if (!cpuLine) return { usage: 0, cores: 0 };

  const usMatch = cpuLine.match(/([\d.]+)\s*us/);
  const usage = usMatch ? parseFloat(usMatch[1]) : 0;

  return { usage, cores: 0 };
}

export function parseDfDisk(output: string): { used: string; total: string; percent: number } {
  const lines = output.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return { used: '0', total: '0', percent: 0 };

  const dataLine = lines[1];
  const parts = dataLine.split(/\s+/);
  const total = parts[1];
  const used = parts[2];
  const percent = parseInt(parts[4], 10);

  return { used, total, percent };
}

export function parseSqueueTasks(output: string): Task[] {
  const lines = output.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    const nodes = parts[5] || '0';
    const reason = parts[7] || '';
    const resources = reason && reason !== 'None'
      ? `${nodes} nodes (${reason})`
      : `${nodes} nodes`;
    return {
      id: parts[0],
      name: parts[2],
      user: parts[3],
      status: parts[6] || 'UNKNOWN',
      runtime: parts[4],
      resources,
    };
  });
}

export function parsePsAuxTasks(output: string): Task[] {
  const lines = output.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  return lines.slice(1, 6).map((line) => {
    const parts = line.split(/\s+/);
    const command = parts.slice(10).join(' ');
    return {
      id: parts[1],
      name: command.length > 30 ? command.substring(0, 30) + '...' : command,
      user: parts[0],
      status: parts[7],
      runtime: parts[9],
      resources: `${parts[3]}% mem`,
    };
  });
}

export function parseCondaEnvs(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.split(/\s+/)[0])
    .filter((name) => name);
}

export function parseNetworkDev(output: string): { rx: string; tx: string } {
  const lines = output.split('\n').filter((line) => line.trim());
  const dataLines = lines.filter((line) => line.includes(':') && !line.includes('Inter'));

  let totalRx = 0;
  let totalTx = 0;

  for (const line of dataLines) {
    const parts = line.split(':');
    if (parts.length < 2) continue;
    const values = parts[1].trim().split(/\s+/).map(Number);
    if (values.length >= 10) {
      totalRx += values[0];
      totalTx += values[8];
    }
  }

  return {
    rx: formatBytes(totalRx),
    tx: formatBytes(totalTx),
  };
}

export function parsePingLatency(output: string): number {
  const match = output.match(/avg\/max\/.*?=\s*[\d.]+\/([\d.]+)\//);
  return match ? parseFloat(match[1]) : 0;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export function parseSacctHistory(output: string, serverId: string): TaskHistoryEntry[] {
  if (!output.trim() || output.includes('NO_SACCT') || output.includes('error') || output.includes('not found')) {
    return [];
  }

  return output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split('|');
      if (parts.length < 7) return null;
      return {
        id: parts[0],
        user: parts[1],
        name: parts[2],
        startTime: parts[3],
        endTime: parts[4],
        duration: parts[5],
        state: parts[6],
        serverId,
      };
    })
    .filter((entry): entry is TaskHistoryEntry => entry !== null);
}
