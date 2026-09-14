export type TaskColor = 'Jaune' | 'Bleu' | 'RougeClair' | 'Vert' | 'Violet' | 'Orange';

export interface Task {
  id: string;
  name: string;
  dependsOn: string | null;
  offset: number;
  duration: number;
  color: TaskColor;
  manualStart: string | null; // YYYY-MM-DD
  computedStart?: Date;
  computedEnd?: Date;
}

export interface Project {
  id: string;
  name: string;
  j0: string; // YYYY-MM-DD
  tasks: Task[];
  createdAt?: string;
  updatedAt?: string;
}

export type SyncStatus = 'saved' | 'saving' | 'error' | 'offline';
