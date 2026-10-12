import { describe, it, expect } from 'vitest';
import { FfmpegVideoTools, runCommand, type CommandRunner } from '../lib/ffmpeg-video-tools.js';
import { ServiceUnavailableError, UpstreamError } from '../errors/domain-errors.js';

describe('runCommand', () => {
  it('reports a missing executable as unavailable', async () => {
    await expect(runCommand('definitely-not-ffmpeg-xyz', ['-version'])).rejects.toThrow(ServiceUnavailableError);
  });

  it('reports a failing executable with its last stderr line', async () => {
    await expect(runCommand(process.execPath, ['-e', 'console.error("first"); console.error("disk full"); process.exit(1)']))
      .rejects.toThrow(new UpstreamError(`${process.execPath} failed: disk full`));
  });

  it('resolves with stdout', async () => {
    await expect(runCommand(process.execPath, ['-e', 'process.stdout.write("ok")'])).resolves.toBe('ok');
  });
});

describe('FfmpegVideoTools', () => {
  const probing = (stdout: string): CommandRunner => async () => stdout;

  it('keeps only keyframe packets with a timestamp and a hash', async () => {
    const tools = new FfmpegVideoTools('ffmpeg', 'ffprobe', probing(JSON.stringify({
      packets: [
        { pts_time: '8.000000', flags: 'K__', data_hash: 'MD5:a' },
        { pts_time: '8.041667', flags: '___', data_hash: 'MD5:b' },
        { pts_time: 'N/A', flags: 'K__', data_hash: 'MD5:c' },
        { pts_time: '10.000000', flags: 'K_D', data_hash: 'MD5:d' },
      ],
    })));

    await expect(tools.listKeyframes('/v.mp4', 6, 9.5)).resolves.toEqual([
      { ptsSeconds: 8, dataHash: 'MD5:a' },
      { ptsSeconds: 10, dataHash: 'MD5:d' },
    ]);
  });

  it('returns null for a video that reports no duration', async () => {
    const tools = new FfmpegVideoTools('ffmpeg', 'ffprobe', probing(JSON.stringify({ format: {} })));

    await expect(tools.durationSeconds('/v.mp4')).resolves.toBeNull();
  });
});
