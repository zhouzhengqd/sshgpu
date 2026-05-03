import React from 'react';
import { ServerWithStatus } from '@shared/types';

interface Props {
  servers: ServerWithStatus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
}

export function ServerList({ servers, selectedId, onSelect, onDelete, searchQuery }: Props) {
  const filtered = servers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="server-list empty">
        <div className="empty-state">
          {servers.length === 0 ? 'No servers found' : 'No matching servers'}
        </div>
      </div>
    );
  }

  const groups = groupServers(filtered);

  return (
    <div className="server-list">
      {Object.entries(groups).map(([group, groupServers]) => (
        <div key={group} className="server-group">
          {group && <div className="group-header">{group}</div>}
          {groupServers.map((server) => (
            <ServerItem
              key={server.id}
              server={server}
              isSelected={server.id === selectedId}
              onClick={() => onSelect(server.id)}
              onDelete={() => onDelete(server.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function groupServers(servers: ServerWithStatus[]): Record<string, ServerWithStatus[]> {
  const groups: Record<string, ServerWithStatus[]> = {};

  for (const server of servers) {
    const group = server.group || '';
    if (!groups[group]) groups[group] = [];
    groups[group].push(server);
  }

  return groups;
}

function ServerItem({
  server,
  isSelected,
  onClick,
  onDelete,
}: {
  server: ServerWithStatus;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusColor =
    server.status === 'online' ? 'var(--color-success)' :
    server.status === 'error' ? 'var(--color-danger)' :
    server.status === 'connecting' ? 'var(--color-warning)' :
    'var(--color-text-tertiary)';

  const gpuSummary = getGpuSummary(server);

  return (
    <div
      className={`server-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <span className="status-dot" style={{ backgroundColor: statusColor }} />
      <div className="server-info">
        <div className="server-name">{server.name}</div>
        <div className="server-gpu">{gpuSummary}</div>
      </div>
      <button
        className="server-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Remove server"
      >
        ×
      </button>
    </div>
  );
}

function getGpuSummary(server: ServerWithStatus): string {
  if (!server.statusData?.gpu.length) return 'No GPU';

  const gpus = server.statusData.gpu;
  const avgUtil = Math.round(
    gpus.reduce((sum, g) => sum + g.utilization, 0) / gpus.length
  );

  return `GPU ${avgUtil}%`;
}
