import React, { useState, useEffect, useCallback } from 'react';
import { TaskHistoryEntry } from '@shared/types';

interface Props {
  serverId: string;
}

export function TaskHistoryTable({ serverId }: Props) {
  const [entries, setEntries] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const data = await window.api.getTaskHistory(serverId);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load task history:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    setLoading(true);
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <div className="no-tasks">Loading history...</div>;
  }

  if (entries.length === 0) {
    return <div className="no-tasks">No task history available</div>;
  }

  const sorted = [...entries].reverse();

  return (
    <div className="task-table">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>User</th>
            <th>State</th>
            <th>Duration</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.id}</td>
              <td>{entry.name}</td>
              <td>{entry.user}</td>
              <td>
                <span className={`status-badge ${entry.state.toLowerCase()}`}>
                  {entry.state}
                </span>
              </td>
              <td>{entry.duration}</td>
              <td>{formatTime(entry.startTime)}</td>
              <td>{formatTime(entry.endTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="history-disclaimer">
        <small>
          Note: History is based on process monitoring. Tasks that start and finish between polls,
          complete while the app is closed, or end while the server is unreachable may not be recorded.
          State "INFERRED" indicates the task disappeared from the running list.
        </small>
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString();
  } catch {
    return isoString;
  }
}
