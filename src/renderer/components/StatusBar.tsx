import React from 'react';

interface Props {
  lastUpdated: Date | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function StatusBar({ lastUpdated, onRefresh, onOpenSettings }: Props) {
  const timeAgo = lastUpdated ? getTimeAgo(lastUpdated) : 'Never';

  return (
    <div className="status-bar">
      <span className="last-updated">Last: {timeAgo}</span>
      <div className="status-actions">
        <button onClick={onRefresh}>Refresh</button>
        <button onClick={onOpenSettings}>Settings</button>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
