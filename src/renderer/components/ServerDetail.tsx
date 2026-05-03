import React, { useState, useEffect } from 'react';
import { ServerWithStatus } from '@shared/types';
import { GpuCard } from './GpuCard';
import { TaskTable } from './TaskTable';
import { TaskHistoryTable } from './TaskHistoryTable';

interface Props {
  server: ServerWithStatus;
  onRefresh: () => void;
  onOpenTerminal: () => void;
}

export function ServerDetail({ server, onRefresh, onOpenTerminal }: Props) {
  const [taskTab, setTaskTab] = useState<'running' | 'history'>('running');
  const [utilHistory, setUtilHistory] = useState<Record<number, number[]>>({});

  useEffect(() => {
    if (server?.id) {
      window.api.getUtilizationHistory(server.id).then(setUtilHistory);
    }
  }, [server?.id, server?.lastUpdated]);

  if (!server.statusData) {
    return (
      <div className="server-detail empty">
        <p>No data available</p>
        <button onClick={onRefresh}>Refresh</button>
      </div>
    );
  }

  const gpu = server.statusData.gpu ?? [];
  const tasks = server.statusData.tasks ?? [];
  const environment = server.statusData.environment ?? { condaEnvs: [], modules: [] };
  const cpu = server.statusData.cpu || { usage: 0, cores: 0 };
  const memory = server.statusData.memory || { used: 0, total: 0, percent: 0 };
  const disk = server.statusData.disk || { used: '0', total: '0', percent: 0 };
  const network = server.statusData.network || { rx: '0 B', tx: '0 B', latency: 0 };
  const slurmQueueDepth = server.statusData.slurmQueueDepth;

  return (
    <div className="server-detail">
      <div className="detail-header">
        <h3>{server.name}</h3>
        <div className="detail-actions">
          <button onClick={onRefresh}>Refresh</button>
          <button onClick={onOpenTerminal}>SSH Terminal</button>
          <div className="export-dropdown">
            <button className="export-btn">Export</button>
            <div className="export-menu">
              <button onClick={() => window.api.exportGpuData('json')}>GPU JSON</button>
              <button onClick={() => window.api.exportGpuData('csv')}>GPU CSV</button>
              <button onClick={() => window.api.exportTaskHistory(server.id, 'json')}>History JSON</button>
              <button onClick={() => window.api.exportTaskHistory(server.id, 'csv')}>History CSV</button>
            </div>
          </div>
        </div>
      </div>

      {gpu.length > 0 && (
        <section className="gpu-section">
          <h4>GPUs</h4>
          <div className="gpu-grid">
            {gpu.map((g) => (
              <GpuCard key={g.index} gpu={g} history={utilHistory[g.index]} />
            ))}
          </div>
        </section>
      )}

      <section className="system-section">
        <h4>System</h4>
        <div className="system-grid">
          <div className="system-item">
            <label>CPU</label>
            <span>{(cpu.usage ?? 0).toFixed(1)}%</span>
          </div>
          <div className="system-item">
            <label>Memory</label>
            <span>{memory.used}/{memory.total} MB ({memory.percent}%)</span>
          </div>
          <div className="system-item">
            <label>Disk</label>
            <span>{disk.used}/{disk.total} ({disk.percent}%)</span>
          </div>
          <div className="system-item">
            <label>Network</label>
            <span>↑{network.tx} ↓{network.rx} | {(network.latency ?? 0).toFixed(1)}ms</span>
          </div>
        </div>
      </section>

      {environment.condaEnvs.length > 0 && (
        <section className="env-section">
          <h4>Conda Environments</h4>
          <div className="env-list">
            {environment.condaEnvs.map((env) => (
              <span key={env} className="env-tag">{env}</span>
            ))}
          </div>
        </section>
      )}

      <section className="tasks-section">
        <div className="tasks-header">
          <h4>
            Tasks
            {slurmQueueDepth !== undefined && slurmQueueDepth > 0 && (
              <span className="slurm-queue-badge">{slurmQueueDepth} pending</span>
            )}
          </h4>
          <div className="tasks-tabs">
            <button
              className={`tab-btn ${taskTab === 'running' ? 'active' : ''}`}
              onClick={() => setTaskTab('running')}
            >
              Running
            </button>
            <button
              className={`tab-btn ${taskTab === 'history' ? 'active' : ''}`}
              onClick={() => setTaskTab('history')}
            >
              History
            </button>
          </div>
        </div>
        {taskTab === 'running' ? (
          <TaskTable tasks={tasks} />
        ) : (
          <TaskHistoryTable serverId={server.id} />
        )}
      </section>
    </div>
  );
}
