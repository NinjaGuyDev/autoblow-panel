import { describe, it, expect, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ModGenerationService } from '../services/mod-generation.service.js';
import {
  ServiceUnavailableError,
  UnprocessableEntityError,
  UpstreamError,
} from '../errors/domain-errors.js';
import type { ScriptModDefinition } from '../types/shared.js';

const VALID_DEFINITION: ScriptModDefinition = {
  version: 1,
  kind: 'sequence-burst',
  ops: [
    { op: 'speed', factor: 2, durationMs: { fixed: null, min: 4_000, max: 10_000 } },
    { op: 'speed', factor: 0.75, durationMs: { fixed: 8_000, min: null, max: null } },
  ],
  trigger: { type: 'random', minGapMs: 15_000 },
};

/** Build a service whose Anthropic client resolves or rejects as instructed. */
function makeService(behaviour: { resolve?: unknown; reject?: unknown }) {
  const create = vi.fn(() =>
    behaviour.reject !== undefined
      ? Promise.reject(behaviour.reject)
      : Promise.resolve(behaviour.resolve),
  );

  const client = { beta: { messages: { create } } } as unknown as Anthropic;
  return { service: new ModGenerationService(() => client), create };
}

function textResponse(payload: unknown) {
  return {
    stop_reason: 'end_turn',
    stop_details: null,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

describe('ModGenerationService', () => {
  it('returns the parsed definition and notes', async () => {
    const { service } = makeService({
      resolve: textResponse({ definition: VALID_DEFINITION, notes: 'Two-stage burst.' }),
    });

    const result = await service.generate({ instruction: 'burst then ease off' });

    expect(result.definition).toEqual(VALID_DEFINITION);
    expect(result.modelNotes).toBe('Two-stage burst.');
  });

  it('sends the documented model, beta, fallback chain and output schema', async () => {
    const { service, create } = makeService({
      resolve: textResponse({ definition: VALID_DEFINITION, notes: null }),
    });

    await service.generate({ instruction: 'go faster' });

    const params = create.mock.calls[create.mock.calls.length - 1]![0] as Record<string, unknown>;
    expect(params.model).toBe('claude-opus-5');
    expect(params.max_tokens).toBe(16_000);
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(params.fallbacks).toBe('default');
    expect(params.output_config).toMatchObject({ format: { type: 'json_schema' } });
  });

  it('passes the script duration to the model as context', async () => {
    const { service, create } = makeService({
      resolve: textResponse({ definition: VALID_DEFINITION, notes: null }),
    });

    await service.generate({ instruction: 'go faster', scriptDurationMs: 120_000 });

    const params = create.mock.calls[create.mock.calls.length - 1]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toContain('120 seconds');
  });

  it('omits the duration hint when no duration is supplied', async () => {
    const { service, create } = makeService({
      resolve: textResponse({ definition: VALID_DEFINITION, notes: null }),
    });

    await service.generate({ instruction: 'go faster' });

    const params = create.mock.calls[create.mock.calls.length - 1]![0] as {
      messages: Array<{ content: string }>;
    };
    expect(params.messages[0]!.content).toBe('go faster');
  });

  it('maps a refusal to 422 and never reads the content', async () => {
    const { service } = makeService({
      resolve: {
        stop_reason: 'refusal',
        stop_details: { category: null, explanation: 'Not something I can help with.' },
        content: [],
      },
    });

    await expect(service.generate({ instruction: 'anything' })).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Not something I can help with.'),
    });
    await expect(service.generate({ instruction: 'anything' })).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
  });

  it('maps a refusal without an explanation to a generic 422', async () => {
    const { service } = makeService({
      resolve: { stop_reason: 'refusal', stop_details: null, content: [] },
    });

    await expect(service.generate({ instruction: 'anything' })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('maps an authentication failure to 503 with the login hint', async () => {
    const { service } = makeService({
      reject: new Anthropic.AuthenticationError(401, undefined, 'nope', new Headers()),
    });

    const error = await service.generate({ instruction: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect((error as Error).message).toContain('ant auth login');
  });

  it('maps a connection failure to 503', async () => {
    const { service } = makeService({
      reject: new Anthropic.APIConnectionError({ message: 'offline' }),
    });

    await expect(service.generate({ instruction: 'x' })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('maps other API errors to 502', async () => {
    const { service } = makeService({
      reject: new Anthropic.BadRequestError(400, undefined, 'bad', new Headers()),
    });

    await expect(service.generate({ instruction: 'x' })).rejects.toMatchObject({ statusCode: 502 });
  });

  it('rejects a definition that violates the numeric ranges the JSON schema cannot express', async () => {
    const outOfRange = {
      ...VALID_DEFINITION,
      ops: [{ op: 'speed', factor: 12, durationMs: { fixed: 5_000, min: null, max: null } }],
    };
    const { service } = makeService({ resolve: textResponse({ definition: outOfRange, notes: null }) });

    await expect(service.generate({ instruction: 'x' })).rejects.toBeInstanceOf(UpstreamError);
  });

  it('rejects a response with no text block', async () => {
    const { service } = makeService({
      resolve: { stop_reason: 'end_turn', stop_details: null, content: [] },
    });

    await expect(service.generate({ instruction: 'x' })).rejects.toBeInstanceOf(UpstreamError);
  });

  it('rejects a response that is not JSON', async () => {
    const { service } = makeService({
      resolve: {
        stop_reason: 'end_turn',
        stop_details: null,
        content: [{ type: 'text', text: 'sorry, here is prose' }],
      },
    });

    await expect(service.generate({ instruction: 'x' })).rejects.toBeInstanceOf(UpstreamError);
  });
});
