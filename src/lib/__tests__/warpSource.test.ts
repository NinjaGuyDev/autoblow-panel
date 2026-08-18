import { describe, it, expect } from 'vitest';
import type { ScriptMod } from '@server/types/shared';
import {
  NO_WARP,
  activeMod,
  resumeAfterEdge,
  startEdge,
  suspendedMod,
  type WarpSource,
} from '../warpSource';

function modNamed(name: string): ScriptMod {
  return {
    id: 1,
    name,
    description: null,
    definition: { version: 1, kind: 'continuous', ops: [], trigger: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const HESITATION = modNamed('Hesitation');
const MOD_SOURCE: WarpSource = { kind: 'mod', mod: HESITATION };

describe('startEdge', () => {
  it('suspends an active mod', () => {
    const source = startEdge(MOD_SOURCE, 30_000);

    expect(source).toEqual({ kind: 'edge', startOriginalMs: 30_000, suspendedMod: HESITATION });
  });

  it('suspends nothing when a speed factor was active', () => {
    expect(suspendedMod(startEdge({ kind: 'factor', factor: 1.4 }, 0))).toBeNull();
  });

  it('keeps the suspended mod when edge mode is re-armed', () => {
    const first = startEdge(MOD_SOURCE, 30_000);
    const second = startEdge(first, 90_000);

    expect(second).toEqual({ kind: 'edge', startOriginalMs: 90_000, suspendedMod: HESITATION });
  });

  it('anchors at the given playhead', () => {
    const source = startEdge(NO_WARP, 12_345);

    expect(source.kind === 'edge' && source.startOriginalMs).toBe(12_345);
  });
});

describe('resumeAfterEdge', () => {
  it('hands back the suspended mod', () => {
    expect(resumeAfterEdge(startEdge(MOD_SOURCE, 30_000))).toEqual(MOD_SOURCE);
  });

  it('falls back to unmodified playback when nothing was suspended', () => {
    expect(resumeAfterEdge(startEdge(NO_WARP, 0))).toEqual(NO_WARP);
  });

  it('does not disturb a factor that replaced edge mode', () => {
    const factor: WarpSource = { kind: 'factor', factor: 0.5 };

    expect(resumeAfterEdge(factor)).toBe(factor);
  });

  it('round-trips a mod through edge mode unchanged', () => {
    expect(resumeAfterEdge(startEdge(MOD_SOURCE, 30_000))).toEqual(MOD_SOURCE);
  });
});

describe('activeMod', () => {
  it('reports the mod shaping playback', () => {
    expect(activeMod(MOD_SOURCE)).toBe(HESITATION);
  });

  it('reports nothing while edge mode holds a mod', () => {
    expect(activeMod(startEdge(MOD_SOURCE, 30_000))).toBeNull();
    expect(suspendedMod(startEdge(MOD_SOURCE, 30_000))).toBe(HESITATION);
  });

  it('reports nothing for a speed factor', () => {
    expect(activeMod({ kind: 'factor', factor: 2 })).toBeNull();
  });
});
