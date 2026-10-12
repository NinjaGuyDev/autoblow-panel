import { describe, it, expect } from 'vitest';
import { isAcceptedVideoFile } from '../videoFileTypes';

describe('isAcceptedVideoFile', () => {
  it.each(['clip.mp4', 'clip.webm', 'clip.ogg', 'clip.mkv'])('accepts %s', name => {
    expect(isAcceptedVideoFile({ name })).toBe(true);
  });

  it('matches extensions case-insensitively', () => {
    expect(isAcceptedVideoFile({ name: 'CLIP.MKV' })).toBe(true);
  });

  it.each(['clip.avi', 'clip.txt', 'mkv', 'clip.mkv.zip'])('rejects %s', name => {
    expect(isAcceptedVideoFile({ name })).toBe(false);
  });
});
