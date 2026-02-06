import Dexie, { type Table } from 'dexie';
import type { WorkSession } from '@/types/funscript';

class AutoblowDB extends Dexie {
  workSessions!: Table<WorkSession>;

  constructor() {
    super('AutoblowPanelDB');
    this.version(1).stores({
      workSessions: '++id, videoName, funscriptName, lastModified',
    });
  }
}

export const db = new AutoblowDB();
