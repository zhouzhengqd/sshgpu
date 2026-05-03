import React from 'react';
import { GPU } from '@shared/types';

interface Props {
  gpu: GPU;
  history?: number[];
  idleThreshold?: number;
}

export function GpuCard({ gpu, history, idleThreshold }: Props) {
  const memoryPercent = gpu.memoryTotal > 0 ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 100) : 0;
  const isIdle = gpu.utilization < (idleThreshold ?? 5);
  const isAvailable = isIdle && memoryPercent < 10;

  const idleDuration = gpu.idleSince
    ? formatDuration(Date.now() - gpu.idleSince.getTime())
    : '';

  // Determine card state: available > idle > active
  const cardClass = isAvailable ? 'available' : isIdle ? 'idle' : '';

  return (
    <div className={`gpu-card ${cardClass}`}>
      <div className="gpu-header">
        <span className="gpu-name">GPU {gpu.index}: {gpu.name}</span>
        <span className="gpu-temp">{gpu.temperature}°C</span>
      </div>
      <div className="gpu-stats">
        <div className="gpu-bar-container">
          <div className="gpu-bar" style={{ width: `${gpu.utilization}%` }} />
          <span className="gpu-bar-label">{gpu.utilization}%</span>
        </div>
        <div className="gpu-memory">
          {gpu.memoryUsed}/{gpu.memoryTotal} MB ({memoryPercent}%)
        </div>
      </div>
      {isAvailable && (
        <div className="gpu-status available" title={gpu.idleSince ? `Since ${gpu.idleSince.toLocaleString()}` : ''}>
          Available {idleDuration && `(${idleDuration})`}
        </div>
      )}
      {isIdle && !isAvailable && (
        <div className="gpu-status idle" title={gpu.idleSince ? `Since ${gpu.idleSince.toLocaleString()}` : ''}>
          Idle {idleDuration && `(${idleDuration})`} — {memoryPercent}% mem used
        </div>
      )}
      {gpu.processes.length > 0 && (
        <div className="gpu-processes">
          {gpu.processes.map((proc) => (
            <div key={proc.pid} className="gpu-process">
              <span className="gpu-process-name">{proc.name}</span>
              <span className="gpu-process-pid">PID {proc.pid}</span>
              <span className="gpu-process-mem">{proc.memoryUsed} MB</span>
            </div>
          ))}
        </div>
      )}
      {history && history.length > 1 && <SparklineChart data={history} />}
    </div>
  );
}

function SparklineChart({ data }: { data: number[] }) {
  const width = 180;
  const height = 30;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  return `${days}d ${hrs}h`;
}
