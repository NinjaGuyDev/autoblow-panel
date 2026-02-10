import type { Funscript as SDKFunscript } from '@xsense/autoblow-sdk';
import type { Funscript } from '@/types/funscript';

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
  // Generate random 32-bit unsigned int for script ID
  const id = Math.floor(Math.random() * 4294967295);

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
