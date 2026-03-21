import type { Funscript as SDKFunscript } from '@xsense/autoblow-sdk';
import type { Funscript, FunscriptAction, FunscriptEnvelope } from '@/types/funscript';
import { generateScriptId } from '@/lib/mathUtils';

/**
 * Build a standard funscript envelope around an actions array.
 * Used everywhere the app constructs a funscript for device upload or persistence.
 */
export function buildFunscript(actions: FunscriptAction[]): FunscriptEnvelope {
  return { version: '1.0', inverted: false, range: 100, actions };
}

/**
 * Converts app Funscript format to SDK Funscript format
 *
 * SDK expects: { metadata: { id, version }, actions: [{ at, pos }] }
 * App provides: Funscript with actions array
 *
 * @param appFunscript - Funscript in app format
 * @returns Funscript in SDK format ready for upload
 */
export function convertToSDKFunscript(appFunscript: Funscript): SDKFunscript {
  const id = generateScriptId();

  return {
    metadata: {
      id,
      version: 1,
    },
    actions: appFunscript.actions.map(action => ({
      at: action.at,
      pos: action.pos,
    })),
  };
}
