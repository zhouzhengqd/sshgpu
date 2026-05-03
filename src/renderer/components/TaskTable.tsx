import React from 'react';
import { Task } from '@shared/types';

interface Props {
  tasks?: Task[];
}

export function TaskTable({ tasks }: Props) {
  if (!tasks || tasks.length === 0) {
    return <div className="no-tasks">No running tasks</div>;
  }

  return (
    <div className="task-table">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>User</th>
            <th>Status</th>
            <th>Runtime</th>
            <th>Resources</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.id}</td>
              <td>{task.name}</td>
              <td>{task.user}</td>
              <td>
                <span className={`status-badge ${task.status.toLowerCase()}`}>
                  {task.status}
                </span>
              </td>
              <td>{task.runtime}</td>
              <td>{task.resources}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
