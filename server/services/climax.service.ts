import type { ClimaxRecord, CreateClimaxRecordRequest, PauseEvent, CreatePauseEventRequest } from '../types/shared.js';
import type { ClimaxRepository } from '../repositories/climax.repository.js';
import type { PauseEventRepository } from '../repositories/pause-event.repository.js';

export class ClimaxService {
  constructor(
    private climaxRepository: ClimaxRepository,
    private pauseEventRepository: PauseEventRepository
  ) {}

  // === Climax Record Methods ===

  getAllClimaxRecords(): ClimaxRecord[] {
    return this.climaxRepository.findAll();
  }

  getClimaxRecordById(id: number): ClimaxRecord {
    const record = this.climaxRepository.findById(id);
    if (!record) {
      throw new Error(`Climax record with id ${id} not found`);
    }
    return record;
  }

  getClimaxRecordsBySession(sessionId: number): ClimaxRecord[] {
    return this.climaxRepository.findBySessionId(sessionId);
  }

  getClimaxRecordsByLibraryItem(libraryItemId: number): ClimaxRecord[] {
    return this.climaxRepository.findByLibraryItemId(libraryItemId);
  }

  createClimaxRecord(data: CreateClimaxRecordRequest): ClimaxRecord {
    // Validate timestamp is non-empty
    if (!data.timestamp || data.timestamp.trim() === '') {
      throw new Error('timestamp is required and cannot be empty');
    }

    // Validate runwayData is valid JSON
    try {
      JSON.parse(data.runwayData);
    } catch (error) {
      throw new Error(`Invalid runwayData JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return this.climaxRepository.create(data);
  }

  deleteClimaxRecord(id: number): void {
    // Verify record exists
    this.getClimaxRecordById(id);
    this.climaxRepository.delete(id);
  }

  getClimaxCountByScript(limit?: number): Array<{libraryItemId: number, climaxCount: number}> {
    return this.climaxRepository.getClimaxCountByScript(limit);
  }

  // === Pause Event Methods ===

  getPauseEventsBySession(sessionId: number): PauseEvent[] {
    return this.pauseEventRepository.findBySessionId(sessionId);
  }

  createPauseEvent(data: CreatePauseEventRequest): PauseEvent {
    // Validate sessionId is provided and positive
    if (!data.sessionId || data.sessionId <= 0) {
      throw new Error('sessionId is required and must be a positive integer');
    }

    // Validate timestamp is non-empty
    if (!data.timestamp || data.timestamp.trim() === '') {
      throw new Error('timestamp is required and cannot be empty');
    }

    return this.pauseEventRepository.create(data);
  }

  resumePauseEvent(id: number, resumedAt: string): PauseEvent {
    const event = this.pauseEventRepository.findById(id);
    if (!event) {
      throw new Error(`Pause event with id ${id} not found`);
    }

    // Compute duration in seconds
    const pauseTime = new Date(event.timestamp).getTime();
    const resumeTime = new Date(resumedAt).getTime();
    const durationSeconds = (resumeTime - pauseTime) / 1000;

    return this.pauseEventRepository.update(id, {
      resumedAt,
      durationSeconds
    });
  }

  deletePauseEvent(id: number): void {
    const event = this.pauseEventRepository.findById(id);
    if (!event) {
      throw new Error(`Pause event with id ${id} not found`);
    }
    this.pauseEventRepository.delete(id);
  }

  getSessionPauseStats(sessionId: number): {totalPauses: number, avgPauseDuration: number} {
    const totalPauses = this.pauseEventRepository.getTotalPausesBySession(sessionId);
    const avgPauseDuration = this.pauseEventRepository.getAvgPauseDuration(sessionId);

    return {
      totalPauses,
      avgPauseDuration
    };
  }
}
