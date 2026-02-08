import type { Funscript as SDKFunscript } from '@xsense/autoblow-sdk';
import type { ZodFunscript } from '@/lib/schemas';

/**
 * Converts app ZodFunscript format to SDK Funscript format
 *
 * SDK expects: { metadata: { id, version }, actions: [{ at, pos }] }
 * App provides: ZodFunscript (union of original/metadata formats)
 *
 * @param appFunscript - Funscript in app format (validated by Zod schema)
 * @returns Funscript in SDK format ready for upload
 */
export function convertToSDKFunscript(appFunscript: ZodFunscript): SDKFunscript {
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
