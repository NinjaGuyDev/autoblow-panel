/**
 * Human-readable summaries of mod definitions, for previewing a generated mod
 * and labelling saved ones.
 */

import type { ModDurationSpec, ScriptModDefinition, ScriptModOp } from '@server/types/shared';

function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

export function formatDurationSpec(spec: ModDurationSpec): string {
  if (spec.fixed != null) return formatSeconds(spec.fixed);
  if (spec.min != null && spec.max != null) {
    return `${formatSeconds(spec.min)}-${formatSeconds(spec.max)}`;
  }
  return 'unspecified';
}

function formatFactor(factor: number): string {
  return `${factor}x`;
}

export function describeOp(op: ScriptModOp): string {
  switch (op.op) {
    case 'speed':
      return `${formatFactor(op.factor)} speed for ${formatDurationSpec(op.durationMs)}`;
    case 'randomSpeed':
      return `random ${formatFactor(op.range[0] ?? 0)}-${formatFactor(op.range[1] ?? 0)} speed, held ${formatDurationSpec(op.holdMs)}`;
    case 'pause':
      return `${formatDurationSpec(op.durationMs)} pause, at most one every ${formatDurationSpec({ fixed: op.minGapMs })} (${Math.round(op.probabilityPerWindow * 100)}% chance)`;
  }
}

/** One-line summary, e.g. "Bursts every 15s: 2x speed for 4-10s, then 0.75x speed for 8s". */
export function describeMod(definition: ScriptModDefinition): string {
  const steps = definition.ops.map(describeOp).join(', then ');

  if (definition.kind === 'sequence-burst') {
    const gap = definition.trigger ? formatDurationSpec({ fixed: definition.trigger.minGapMs }) : '?';
    return `Bursts at least ${gap} apart: ${steps}`;
  }

  return `Throughout the script: ${steps}`;
}
