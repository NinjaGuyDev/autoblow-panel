import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FfmpegVideoTools, runCommand } from '../lib/ffmpeg-video-tools.js';
import { MediaFileService } from '../services/media-file.service.js';
import { TrimToFunscriptService } from '../services/trim-to-funscript.service.js';
import type { CreateLibraryItemRequest, LibraryItem } from '../types/shared.js';

const hasFfmpeg = ['ffmpeg', 'ffprobe'].every(tool => spawnSync(tool, ['-version']).status === 0);

/** One frame at 24 fps; the cut must be exact to within this */
const FRAME_SECONDS = 1 / 24;

/** Decoded frames of the first video stream as [presentation seconds, content hash] */
function decodedFrames(videoPath: string): Array<[number, string]> {
  const { stdout } = spawnSync('ffmpeg', ['-v', 'error', '-i', videoPath, '-map', '0:v:0', '-f', 'framemd5', '-'], { encoding: 'utf8' });
  const [num, den] = /#tb 0: (\d+)\/(\d+)/.exec(stdout)!.slice(1).map(Number);
  return stdout.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(/,\s*/))
    .map(fields => [Number(fields[2]) * num! / den!, fields[5]!]);
}

/** Source time minus trimmed time for the trimmed video's first frame, found by content */
function trueOffsetSeconds(sourcePath: string, trimmedPath: string): number {
  const [[trimmedTime, hash]] = decodedFrames(trimmedPath) as [[number, string]];
  const sourceTime = decodedFrames(sourcePath).find(([, sourceHash]) => sourceHash === hash)![0];
  return sourceTime - trimmedTime;
}

describe.skipIf(!hasFfmpeg)('trim to funscript with real ffmpeg', () => {
  let mediaDir: string;
  let service: TrimToFunscriptService;
  const saved: CreateLibraryItemRequest[] = [];

  beforeAll(() => {
    mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trim-to-funscript-ffmpeg-'));
    fs.mkdirSync(path.join(mediaDir, 'thumbnails'));
    // 20 s of moving test pattern plus a tone, with a keyframe every 2 s
    spawnSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=20:size=320x240:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20',
      '-c:v', 'libx264', '-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-c:a', 'aac', '-shortest',
      path.join(mediaDir, 'clip.mp4'),
    ]);
    spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(mediaDir, 'clip.mp4'), '-c', 'copy', path.join(mediaDir, 'clip.mkv')]);

    const mediaFiles = new MediaFileService(mediaDir);
    const library = {
      createItem: vi.fn((data: CreateLibraryItemRequest): LibraryItem => {
        saved.push(data);
        return { id: saved.length, lastModified: 'now', ...data };
      }),
    };
    service = new TrimToFunscriptService(mediaFiles, new FfmpegVideoTools('ffmpeg', 'ffprobe', runCommand), library);
  });

  afterAll(() => {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  });

  it.each(['clip.mp4', 'clip.mkv'])('shifts the script by exactly what was cut from %s', async videoName => {
    const funscriptData = JSON.stringify({ actions: [{ at: 12_500, pos: 90 }, { at: 13_000, pos: 0 }] });

    const { item, cutMs } = await service.trim({ videoName, funscriptName: null, funscriptData });

    const trimmedPath = path.join(mediaDir, item.videoName!);
    expect(Math.abs(cutMs / 1000 - trueOffsetSeconds(path.join(mediaDir, videoName), trimmedPath))).toBeLessThan(FRAME_SECONDS);
    expect(JSON.parse(item.funscriptData).actions[0].at).toBe(12_500 - cutMs);
    expect(item.duration).toBeGreaterThan(20 - cutMs / 1000 - 0.5);
    expect(fs.existsSync(path.join(mediaDir, 'thumbnails', `${path.parse(item.videoName!).name}.jpg`))).toBe(true);
  }, 30_000);
});
