import { ConnectionManager } from './ssh/connection-manager';
import { DataStore } from './store';
import { HistoryStore } from './history-store';
import {
  parseNvidiaSmi,
  parseGpuProcesses,
  parseFreeMemory,
  parseTopCpu,
  parseDfDisk,
  parseSqueueTasks,
  parsePsAuxTasks,
  parseCondaEnvs,
  parseNetworkDev,
  parsePingLatency,
} from './ssh/output-parser';
import { Server, ServerStatus, Task, TaskHistoryEntry, CustomCommand } from '@shared/types';
import { EventEmitter } from 'events';

interface CollectionCommand {
  name: string;
  command: string;
  parser: (output: string) => any;
}

export class DataCollector extends EventEmitter {
  private connectionManager: ConnectionManager;
  private store: DataStore;
  private historyStore: HistoryStore;
  private intervalId: NodeJS.Timeout | null = null;
  private pollingInterval: number;
  // Track running tasks per server: serverId -> Map(taskId -> {task, startTime})
  private runningTasks = new Map<string, Map<string, { task: Task; startTime: Date }>>();

  constructor(
    connectionManager: ConnectionManager,
    store: DataStore,
    historyStore: HistoryStore,
    config: { pollingInterval?: number }
  ) {
    super();
    this.connectionManager = connectionManager;
    this.store = store;
    this.historyStore = historyStore;
    this.pollingInterval = ((config && config.pollingInterval) || 120) * 1000;
  }

  buildCommands(customCommands?: CustomCommand[]): CollectionCommand[] {
    const commands: CollectionCommand[] = [
      {
        name: 'gpu',
        command: 'nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu,uuid --format=csv,noheader,nounits 2>/dev/null || echo ""',
        parser: parseNvidiaSmi,
      },
      {
        name: 'gpu-processes',
        command: 'nvidia-smi --query-compute-apps=gpu_uuid,pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null || echo ""',
        parser: parseGpuProcesses,
      },
      {
        name: 'cpu',
        command: "top -bn1 | head -5",
        parser: parseTopCpu,
      },
      {
        name: 'memory',
        command: 'free -m',
        parser: parseFreeMemory,
      },
      {
        name: 'disk',
        command: 'df -h /',
        parser: parseDfDisk,
      },
      {
        name: 'tasks',
        command: 'squeue -u $USER -o "%.18i %.9P %.30j %.8u %.10M %.6D %.10T %.10R" 2>/dev/null || echo "NO_SLURM"',
        parser: (output: string) => {
          if (output.includes('NO_SLURM')) return null;
          return parseSqueueTasks(output);
        },
      },
      {
        name: 'processes',
        command: 'ps aux --sort=-%mem | head -6',
        parser: parsePsAuxTasks,
      },
      {
        name: 'conda',
        command: 'conda env list 2>/dev/null || echo ""',
        parser: parseCondaEnvs,
      },
      {
        name: 'network',
        command: 'cat /proc/net/dev',
        parser: parseNetworkDev,
      },
    ];

    if (customCommands) {
      for (const cmd of customCommands) {
        commands.push({
          name: cmd.name,
          command: cmd.command,
          parser: (output: string) => output.trim(),
        });
      }
    }

    return commands;
  }

  private trackTaskHistory(serverId: string, currentTasks: Task[]): void {
    const previous = this.runningTasks.get(serverId) || new Map();
    const current = new Map<string, Task>();
    for (const task of currentTasks) {
      current.set(task.id, task);
    }

    // Find completed tasks (were running, now gone)
    // Note: State is "INFERRED" because we can't determine if the task
    // completed successfully, failed, or was cancelled - we only know it disappeared
    for (const [taskId, { task, startTime }] of previous) {
      if (!current.has(taskId)) {
        const entry: TaskHistoryEntry = {
          id: task.id,
          user: task.user,
          name: task.name,
          startTime: startTime.toISOString(),
          endTime: new Date().toISOString(),
          duration: task.runtime,
          state: 'INFERRED',
          serverId,
        };
        this.historyStore.addEntries(serverId, [entry]);
        this.emit('history-updated', serverId);
        this.emit('task-completed', serverId, entry);
      }
    }

    // Find new tasks (are running, weren't before)
    const updated = new Map<string, { task: Task; startTime: Date }>();
    for (const task of currentTasks) {
      const existing = previous.get(task.id);
      updated.set(task.id, {
        task,
        startTime: existing?.startTime || new Date(),
      });
    }

    this.runningTasks.set(serverId, updated);
  }

  async collectServer(server: Server): Promise<void> {
    const commands = this.buildCommands(server.customCommands);

    try {
      const results: Record<string, any> = {};

      for (const cmd of commands) {
        try {
          const output = await this.connectionManager.execute(server.id, cmd.command);
          results[cmd.name] = cmd.parser(output);
        } catch (err) {
          results[cmd.name] = null;
        }
      }

      const slurmTasks = Array.isArray(results.tasks) ? results.tasks : [];
      const processTasks = Array.isArray(results.processes) ? results.processes : [];
      const tasks = slurmTasks.length > 0 ? slurmTasks : processTasks;
      console.log(`[Collector] ${server.name} slurmTasks: ${slurmTasks.length}, processTasks: ${processTasks.length}, tasks: ${tasks.length}`);

      // Merge GPU processes into GPU objects by UUID
      const gpuList: GPU[] = results.gpu || [];
      const gpuProcesses = results['gpu-processes'];
      if (gpuList.length > 0 && gpuProcesses instanceof Map) {
        for (const gpu of gpuList) {
          if (gpu.uuid) {
            gpu.processes = gpuProcesses.get(gpu.uuid) || [];
          }
        }
      }

      // Track task history locally
      this.trackTaskHistory(server.id, tasks);

      const slurmPending = slurmTasks.filter((t: Task) => t.status === 'PENDING').length;

      const status: ServerStatus = {
        gpu: gpuList,
        cpu: results.cpu || { usage: 0, cores: 0 },
        memory: results.memory || { used: 0, total: 0, percent: 0 },
        disk: results.disk || { used: '0', total: '0', percent: 0 },
        network: results.network || { rx: '0 B', tx: '0 B', latency: 0 },
        tasks,
        environment: {
          condaEnvs: results.conda || [],
          modules: [],
        },
        slurmQueueDepth: slurmTasks.length > 0 ? slurmPending : undefined,
      };

      this.store.updateServerStatus(server.id, status);
      this.emit('status-updated', server.id, status);
    } catch (err) {
      this.store.setServerError(server.id);
      this.emit('collection-error', server.id, err);
    }
  }

  async collectAll(): Promise<void> {
    const servers = this.store.getAllServers();
    const promises = servers.map((server) => this.collectServer(server));
    await Promise.allSettled(promises);
    this.emit('collection-complete');
  }

  start(): void {
    if (this.intervalId) return;

    this.collectAll().catch(() => {});

    this.intervalId = setInterval(() => {
      this.collectAll().catch(() => {});
    }, this.pollingInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateInterval(seconds: number): void {
    this.pollingInterval = seconds * 1000;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  removeServer(serverId: string): void {
    this.runningTasks.delete(serverId);
  }
}
