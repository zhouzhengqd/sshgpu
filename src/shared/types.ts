export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  source: 'ssh-config' | 'manual';
  jumpHost?: string;
  group?: string;
  identityFile?: string;
  status: 'online' | 'offline' | 'connecting' | 'error';
  lastUpdated: Date | null;
  customCommands?: CustomCommand[];
}

export interface CustomCommand {
  id: string;
  name: string;
  command: string;
}

export interface ServerStatus {
  gpu: GPU[];
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percent: number };
  disk: { used: string; total: string; percent: number };
  network: { rx: string; tx: string; latency: number };
  tasks: Task[];
  environment: { condaEnvs: string[]; modules: string[] };
  slurmQueueDepth?: number;
}

export interface GPU {
  index: number;
  name: string;
  uuid?: string;
  memoryUsed: number;
  memoryTotal: number;
  utilization: number;
  temperature: number;
  processes: GPUProcess[];
  idleSince: Date | null;
}

export interface GPUProcess {
  pid: number;
  name: string;
  memoryUsed: number;
}

export interface Task {
  id: string;
  name: string;
  user: string;
  status: string;
  runtime: string;
  resources: string;
}

export interface TaskHistoryEntry {
  id: string;
  user: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: string;
  state: string;
  serverId: string;
}

export interface ManualServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  jumpHost?: string;
  group?: string;
  identityFile?: string;
  customCommands?: CustomCommand[];
}

export interface AppConfig {
  servers: ManualServerConfig[];
  disabledServerIds: string[];   // server IDs hidden from UI
  pollingInterval: number;       // seconds
  idleThreshold: number;         // minutes
  idleUtilizationThreshold?: number; // percentage, default 5
  notificationEnabled: boolean;
  quietHoursStart?: string;      // "22:00"
  quietHoursEnd?: string;        // "08:00"
  terminalApp: 'Terminal.app' | 'iTerm2';
  taskTemplates?: TaskTemplate[];
  dingtalkWebhook?: string;
  theme?: 'system' | 'light' | 'dark';
}

export interface TaskTemplate {
  id: string;
  name: string;
  script: string;
  defaultArgs?: string;
}

// IPC channel types
export interface IpcChannels {
  'get-servers': { request: void; response: ServerWithStatus[] };
  'refresh-server': { request: string; response: void };
  'refresh-all': { request: void; response: void };
  'add-server': { request: ManualServerConfig; response: void };
  'update-server': { request: ManualServerConfig; response: void };
  'delete-server': { request: string; response: void };
  'open-terminal': { request: string; response: void };
  'submit-job': { request: { serverId: string; templateId: string }; response: void };
  'get-config': { request: void; response: AppConfig };
  'update-config': { request: Partial<AppConfig>; response: void };
  'servers-updated': { response: ServerWithStatus[] };
  'get-task-history': { request: string; response: TaskHistoryEntry[] };
}

export interface ServerWithStatus extends Server {
  statusData: ServerStatus | null;
}
