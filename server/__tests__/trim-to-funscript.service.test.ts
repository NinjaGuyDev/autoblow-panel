import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MediaFileService } from '../services/media-file.service.js';
import { TrimToFunscriptService, type LibraryItemCreator } from '../services/trim-to-funscript.service.js';
import type { VideoTools } from '../lib/ffmpeg-video-tools.js';
import type { KeyframePacket } from '../lib/keyframe-cut.js';
import type { CreateLibraryItemRequest, LibraryItem } from '../types/shared.js';
import { NotFoundError, UnprocessableEntityError, UpstreamError, ValidationError } from '../errors/domain-errors.js';

const keyframe = (ptsSeconds: number): KeyframePacket => ({ ptsSeconds, dataHash: `hash-${ptsSeconds}` });

/** Keyframes every 2 s, as a typical encode would have */
const SOURCE_KEYFRAMES = [0, 2, 4, 6, 8, 10, 12].map(keyframe);

function scriptStartingAt(firstActionMs: number): string {
  return JSON.stringify({
    metadata: { duration: 60 },
    actions: [{ at: firstActionMs, pos: 90 }, { at: firstActionMs + 500, pos: 0 }],
  });
}

function fakeVideoTools(outputStartsOn: KeyframePacket | null = { ptsSeconds: 0, dataHash: 'hash-8' }): VideoTools {
  return {
    listKeyframes: vi.fn(async (_path: string, from: number, to: number) =>
      SOURCE_KEYFRAMES.filter(k => k.ptsSeconds >= Math.floor(from / 2) * 2 && k.ptsSeconds <= to)),
    firstKeyframe: vi.fn(async () => outputStartsOn),
    copyFromKeyframe: vi.fn(async (_source: string, _start: number, output: string) => fs.writeFileSync(output, 'trimmed')),
    durationSeconds: vi.fn(async () => 52),
    captureFrame: vi.fn(async (_video: string, _at: number, output: string) => fs.writeFileSync(output, 'jpeg')),
  };
}

describe('TrimToFunscriptService', () => {
  let mediaDir: string;
  let mediaFiles: MediaFileService;
  let library: LibraryItemCreator & { createItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trim-to-funscript-'));
    fs.mkdirSync(path.join(mediaDir, 'thumbnails'));
    fs.writeFileSync(path.join(mediaDir, 'MyClip.mp4'), 'original');
    mediaFiles = new MediaFileService(mediaDir);
    library = {
      createItem: vi.fn((data: CreateLibraryItemRequest): LibraryItem => ({ id: 7, lastModified: 'now', ...data })),
    };
  });

  afterEach(() => {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  });

  const trimmer = (tools: VideoTools) => new TrimToFunscriptService(mediaFiles, tools, library);
  const request = (firstActionMs: number) => ({
    videoName: 'My Clip.mp4',
    funscriptName: 'My Clip.funscript',
    funscriptData: scriptStartingAt(firstActionMs),
  });

  it('cuts at the last keyframe before the lead-in and saves a shifted copy', async () => {
    const tools = fakeVideoTools();

    // First action at 12.5 s, so the cut aims at 9.5 s and lands on the 8 s keyframe
    const result = await trimmer(tools).trim(request(12_500));

    expect(tools.copyFromKeyframe).toHaveBeenCalledWith(path.join(mediaDir, 'MyClip.mp4'), 8, path.join(mediaDir, 'MyClip-trimmed.mp4'));
    expect(result.cutMs).toBe(8_000);
    const saved = library.createItem.mock.calls[library.createItem.mock.calls.length - 1][0] as CreateLibraryItemRequest;
    expect(saved).toMatchObject({ videoName: 'MyClip-trimmed.mp4', funscriptName: 'My Clip (trimmed).funscript', duration: 52 });
    expect(JSON.parse(saved.funscriptData)).toEqual({
      metadata: { duration: 52 },
      actions: [{ at: 4_500, pos: 90 }, { at: 5_000, pos: 0 }],
    });
    expect(fs.readFileSync(path.join(mediaDir, 'MyClip.mp4'), 'utf8')).toBe('original');
  });

  it('shifts by where the cut really landed when the demuxer seeks a keyframe early', async () => {
    const tools = fakeVideoTools({ ptsSeconds: 0.083, dataHash: 'hash-6' });

    const result = await trimmer(tools).trim(request(12_500));

    expect(result.cutMs).toBe(5_917);
  });

  it('looks back from the start when the real cut is before the first search window', async () => {
    const tools = fakeVideoTools({ ptsSeconds: 0, dataHash: 'hash-2' });
    // The first probe only reaches back to 6 s; the fallback lists from 0
    vi.mocked(tools.listKeyframes).mockResolvedValueOnce([keyframe(6), keyframe(8)]);

    const result = await trimmer(tools).trim(request(12_500));

    expect(tools.listKeyframes).toHaveBeenLastCalledWith(path.join(mediaDir, 'MyClip.mp4'), 0, 8);
    expect(result.cutMs).toBe(2_000);
  });

  it('captures the thumbnail at the first action in the trimmed video', async () => {
    const tools = fakeVideoTools();

    await trimmer(tools).trim(request(12_500));

    expect(tools.captureFrame).toHaveBeenCalledWith(
      path.join(mediaDir, 'MyClip-trimmed.mp4'), 4.5, path.join(mediaDir, 'thumbnails', 'MyClip-trimmed.jpg'), 480);
  });

  it('still saves the item when the thumbnail fails', async () => {
    const tools = fakeVideoTools();
    vi.mocked(tools.captureFrame).mockRejectedValueOnce(new UpstreamError('ffmpeg failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(trimmer(tools).trim(request(12_500))).resolves.toMatchObject({ cutMs: 8_000 });
    expect(fs.readdirSync(path.join(mediaDir, 'thumbnails'))).toEqual([]);
  });

  it('numbers the copy when a trimmed video already exists', async () => {
    fs.writeFileSync(path.join(mediaDir, 'MyClip-trimmed.mp4'), 'earlier trim');

    const result = await trimmer(fakeVideoTools()).trim(request(12_500));

    expect(result.item.videoName).toBe('MyClip-trimmed-2.mp4');
    expect(fs.readFileSync(path.join(mediaDir, 'MyClip-trimmed.mp4'), 'utf8')).toBe('earlier trim');
  });

  it('skips a name whose thumbnail belongs to a same-stem video in another container', async () => {
    fs.writeFileSync(path.join(mediaDir, 'MyClip-trimmed.mkv'), 'other trim');
    fs.writeFileSync(path.join(mediaDir, 'thumbnails', 'MyClip-trimmed.jpg'), 'other thumbnail');

    const result = await trimmer(fakeVideoTools()).trim(request(12_500));

    expect(result.item.videoName).toBe('MyClip-trimmed-2.mp4');
    expect(fs.readFileSync(path.join(mediaDir, 'thumbnails', 'MyClip-trimmed.jpg'), 'utf8')).toBe('other thumbnail');
  });

  it('leaves a same-stem thumbnail in place when the trim fails', async () => {
    fs.writeFileSync(path.join(mediaDir, 'MyClip-trimmed.mkv'), 'other trim');
    fs.writeFileSync(path.join(mediaDir, 'thumbnails', 'MyClip-trimmed.jpg'), 'other thumbnail');
    const tools = fakeVideoTools();
    vi.mocked(tools.copyFromKeyframe).mockRejectedValueOnce(new UpstreamError('ffmpeg failed'));

    await expect(trimmer(tools).trim(request(12_500))).rejects.toThrow(UpstreamError);

    expect(fs.readFileSync(path.join(mediaDir, 'thumbnails', 'MyClip-trimmed.jpg'), 'utf8')).toBe('other thumbnail');
    expect(fs.readdirSync(mediaDir).sort()).toEqual(['MyClip-trimmed.mkv', 'MyClip.mp4', 'thumbnails']);
  });

  it('removes the partial video and thumbnail when the copy fails', async () => {
    const tools = fakeVideoTools();
    vi.mocked(tools.copyFromKeyframe).mockRejectedValueOnce(new UpstreamError('ffmpeg failed: disk full'));

    await expect(trimmer(tools).trim(request(12_500))).rejects.toThrow(UpstreamError);

    expect(fs.readdirSync(mediaDir).sort()).toEqual(['MyClip.mp4', 'thumbnails']);
    expect(library.createItem).not.toHaveBeenCalled();
  });

  it('removes the trimmed files when the cut cannot be verified', async () => {
    const tools = fakeVideoTools({ ptsSeconds: 0, dataHash: 'unknown' });

    await expect(trimmer(tools).trim(request(12_500))).rejects.toThrow(UpstreamError);

    expect(fs.readdirSync(mediaDir).sort()).toEqual(['MyClip.mp4', 'thumbnails']);
    expect(fs.readdirSync(path.join(mediaDir, 'thumbnails'))).toEqual([]);
  });

  it('refuses a script that starts within the lead-in, before touching the video', async () => {
    const tools = fakeVideoTools();

    await expect(trimmer(tools).trim(request(3_500))).rejects.toThrow(UnprocessableEntityError);

    expect(tools.listKeyframes).not.toHaveBeenCalled();
  });

  it('refuses when the only keyframe before the target is at the very start', async () => {
    const tools = fakeVideoTools();

    // Target 1.5 s: the latest keyframe at or before it is the one at 0 s
    await expect(trimmer(tools).trim(request(4_500))).rejects.toThrow(UnprocessableEntityError);

    expect(tools.copyFromKeyframe).not.toHaveBeenCalled();
  });

  it('removes the trimmed files when the measured cut is too short to keep', async () => {
    const tools = fakeVideoTools({ ptsSeconds: 0, dataHash: 'hash-0' });

    await expect(trimmer(tools).trim(request(12_500))).rejects.toThrow(UnprocessableEntityError);

    expect(fs.readdirSync(mediaDir).sort()).toEqual(['MyClip.mp4', 'thumbnails']);
  });

  it('reports a video that is not in the media directory', async () => {
    await expect(trimmer(fakeVideoTools()).trim({ ...request(12_500), videoName: 'missing.mp4' }))
      .rejects.toThrow(NotFoundError);
  });

  it.each(['not json', '{"actions":[]}', '{"title":"no actions"}'])('rejects funscriptData %s', async funscriptData => {
    await expect(trimmer(fakeVideoTools()).trim({ ...request(12_500), funscriptData }))
      .rejects.toThrow(ValidationError);
  });
});
