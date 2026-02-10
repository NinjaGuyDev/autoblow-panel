import type { Session, CreateSessionRequest, UpdateSessionRequest, SessionStats, MostPlayedScript, ScriptOrderEntry } from '../types/shared.js';
import type { SessionRepository } from '../repositories/session.repository.js';

export class SessionService {
  constructor(private sessionRepository: SessionRepository) {}

  getAllSessions(): Session[] {
    return this.sessionRepository.findAll();
  }

  getSessionById(id: number): Session {
    const session = this.sessionRepository.findById(id);
    if (!session) {
      throw new Error(`Session with id ${id} not found`);
    }
    return session;
  }

  getSessionsByDateRange(startDate: string, endDate: string): Session[] {
    return this.sessionRepository.findByDateRange(startDate, endDate);
  }

  createSession(data: CreateSessionRequest): Session {
    // Validate context
    const validContexts = ['normal', 'demo', 'manual'];
    if (!validContexts.includes(data.context)) {
      throw new Error(`Invalid context: ${data.context}. Must be one of: ${validContexts.join(', ')}`);
    }

    // Validate startedAt is provided and non-empty
    if (!data.startedAt || data.startedAt.trim() === '') {
      throw new Error('startedAt is required and cannot be empty');
    }

    return this.sessionRepository.create(data);
  }

  updateSession(id: number, data: UpdateSessionRequest): Session {
    // Verify session exists
    this.getSessionById(id);
    return this.sessionRepository.update(id, data);
  }

  appendScriptToSession(id: number, libraryItemId: number, timestamp: string): Session {
    const session = this.getSessionById(id);

    // Parse existing scriptOrder
    const scriptOrder: ScriptOrderEntry[] = JSON.parse(session.scriptOrder);

    // Append new entry
    scriptOrder.push({ libraryItemId, timestamp });

    // Update session with new scriptOrder
    return this.sessionRepository.update(id, {
      scriptOrder: JSON.stringify(scriptOrder)
    });
  }

  endSession(id: number, endedAt: string): Session {
    const session = this.getSessionById(id);

    // Compute duration in seconds
    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date(endedAt).getTime();
    const durationSeconds = (endTime - startTime) / 1000;

    return this.sessionRepository.update(id, {
      endedAt,
      durationSeconds
    });
  }

  deleteSession(id: number): void {
    // Verify session exists
    this.getSessionById(id);
    this.sessionRepository.delete(id);
  }

  getStats(): SessionStats {
    return this.sessionRepository.getStats();
  }

  getMostPlayed(limit?: number): MostPlayedScript[] {
    return this.sessionRepository.getMostPlayed(limit);
  }
}
