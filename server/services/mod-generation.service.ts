import Anthropic from '@anthropic-ai/sdk';
import type { GenerateScriptModRequest, GenerateScriptModResponse } from '../types/shared.js';
import {
  GENERATE_SCRIPT_MOD_JSON_SCHEMA,
  ScriptModDefinitionSchema,
} from '../schemas/script-mod.schemas.js';
import {
  ServiceUnavailableError,
  UnprocessableEntityError,
  UpstreamError,
} from '../errors/domain-errors.js';

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 16_000;
const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/**
 * The SDK defaults to a multi-minute timeout and several retries. A user is
 * sitting in front of the "Create from text" dialog while this runs, so the
 * request is bounded to one generation attempt plus a single retry.
 */
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 1;

const AUTH_HINT = 'Mod generation needs Claude credentials — run `ant auth login` and restart the server.';

/** Message prefix the SDK throws from `validateHeaders` when no credentials resolve. */
const UNRESOLVED_CREDENTIALS_PREFIX = 'Could not resolve authentication method';

const SYSTEM_PROMPT = `You design "script mods" for a haptic device playback app. A mod is a time-axis program that speeds up, slows down, and pauses an existing motion script. Mods never change positions, only timing.

Output a mod definition using this DSL.

kind:
- "continuous" — the ops fill the entire script, cycling through the speed ops in order from the start. Use this when the instruction describes ongoing or repeated variation across the whole script.
- "sequence-burst" — the op list runs once as a burst, then the script returns to original speed until the next burst. Use this when the instruction describes an occasional event with a defined shape.

ops (at least one):
- { "op": "speed", "factor": <number>, "durationMs": <duration> } — hold an exact speed. factor 1.0 is original speed, 2.0 is twice as fast, 0.75 is three quarters speed.
- { "op": "randomSpeed", "range": [<min>, <max>], "holdMs": <duration> } — draw a speed uniformly from the range, hold it, then draw again.
- { "op": "pause", "durationMs": <duration>, "minGapMs": <number>, "probabilityPerWindow": <0..1> } — freeze the device. In a continuous mod one pause is offered every minGapMs and taken with probabilityPerWindow, which guarantees pauses never land closer together than minGapMs. In a sequence-burst mod the pause fires at its place in the op list and both fields are ignored (still supply sane values).

duration: either { "fixed": <ms>, "min": null, "max": null } for an exact length, or { "fixed": null, "min": <ms>, "max": <ms> } for a uniform random length. Always emit all three keys.

trigger: for "sequence-burst" use { "type": "random", "minGapMs": <ms> } — the minimum quiet time between bursts. For "continuous" use null.

Hard constraints:
- version is always 1.
- Every speed factor must be between 0.1 and 4.0.
- Every duration in milliseconds must be a positive integer.
- "range" must have exactly two numbers, ordered [min, max].
- A "continuous" mod must contain at least one "speed" or "randomSpeed" op.

Translate the user's instruction as literally as the DSL allows. Do not invent constraints they did not ask for, and prefer the smallest op list that expresses the request.`;

/** Lets the Anthropic client be swapped out in tests and constructed lazily. */
export type AnthropicClientFactory = () => Anthropic;

interface GeneratedPayload {
  definition: unknown;
  notes?: unknown;
}

export class ModGenerationService {
  constructor(private createClient: AnthropicClientFactory) {}

  /**
   * Turn a natural-language instruction into a mod definition.
   * The result is not persisted — the client previews it and saves via POST /api/mods.
   *
   * @throws UnprocessableEntityError when the model declines the request.
   * @throws UpstreamError when the response cannot be read as a valid mod.
   * @throws ServiceUnavailableError when Claude is unreachable or unauthenticated.
   */
  async generate(request: GenerateScriptModRequest): Promise<GenerateScriptModResponse> {
    const message = await this.requestMod(request);

    // stop_reason must be checked before touching content — a refusal has none.
    if (message.stop_reason === 'refusal') {
      const explanation = message.stop_details?.explanation;
      throw new UnprocessableEntityError(
        explanation
          ? `Claude declined to generate this mod: ${explanation}`
          : 'Claude declined to generate this mod.',
      );
    }

    const payload = this.readPayload(message.content);
    const result = ScriptModDefinitionSchema.safeParse(payload.definition);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new UpstreamError(
        `Claude returned an invalid mod definition: ${issue?.path.join('.')} ${issue?.message}`.trim(),
      );
    }

    return {
      definition: result.data,
      modelNotes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  private async requestMod(request: GenerateScriptModRequest) {
    const durationHint = request.scriptDurationMs
      ? `\n\nThe script this mod will run against is about ${Math.round(request.scriptDurationMs / 1000)} seconds long.`
      : '';

    try {
      return await this.createClient().beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: [SERVER_SIDE_FALLBACK_BETA],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        output_config: {
          format: { type: 'json_schema', schema: GENERATE_SCRIPT_MOD_JSON_SCHEMA },
        },
        messages: [{ role: 'user', content: `${request.instruction}${durationHint}` }],
      }, { timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
    } catch (error) {
      throw this.toDomainError(error);
    }
  }

  private readPayload(content: Anthropic.Beta.BetaContentBlock[]): GeneratedPayload {
    const text = content.find(block => block.type === 'text')?.text;
    if (!text) {
      throw new UpstreamError('Claude returned no mod definition.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new UpstreamError('Claude returned a response that was not valid JSON.');
    }

    if (parsed === null || typeof parsed !== 'object') {
      throw new UpstreamError('Claude returned a response that was not a mod object.');
    }
    return parsed as GeneratedPayload;
  }

  /**
   * Map SDK error classes onto domain errors.
   *
   * Classes are the primary signal. The one exception is the SDK's
   * credential-resolution failure: `new Anthropic()` resolves credentials
   * lazily and the request path then throws a plain `Error` with no dedicated
   * class, so it is recognised by its message prefix. If that wording ever
   * changes the check simply stops matching and the error falls through to the
   * generic branch — it cannot misclassify anything else.
   */
  private toDomainError(error: unknown): Error {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      return new ServiceUnavailableError(AUTH_HINT);
    }

    // Checked before APIConnectionError, which it extends
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new ServiceUnavailableError(
        'Claude took too long to generate this mod — try again with a shorter instruction.',
      );
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new ServiceUnavailableError(`Could not reach Claude. ${AUTH_HINT}`);
    }

    if (error instanceof Anthropic.RateLimitError) {
      return new ServiceUnavailableError('Claude is rate limiting mod generation — try again shortly.');
    }

    if (error instanceof Anthropic.APIError) {
      return new UpstreamError(`Claude rejected the mod generation request (HTTP ${error.status ?? 'unknown'}).`);
    }

    // A missing or unresolvable `ant auth login` profile surfaces either as a
    // bare AnthropicError or as the plain Error below — both mean no credentials
    if (error instanceof Anthropic.AnthropicError || this.isMissingCredentials(error)) {
      return new ServiceUnavailableError(AUTH_HINT);
    }

    return error instanceof Error ? error : new Error('Mod generation failed');
  }

  private isMissingCredentials(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith(UNRESOLVED_CREDENTIALS_PREFIX);
  }
}
