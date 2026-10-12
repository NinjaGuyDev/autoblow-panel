import path from 'path';
import {
  trimCutTargetMs,
  TRIM_LEAD_IN_MS,
  TRIM_MIN_CUT_MS,
  type TrimToFunscriptRequest,
  type TrimToFunscriptResult,
} from '../types/shared.js';
import { FunscriptDocumentSchema, type FunscriptDocument } from '../schemas/media.schemas.js';
import { earliestActionMs, shiftFunscriptStart } from '../lib/funscript-shift.js';
import { latestKeyframeAtOrBefore, measureCutOffsetSeconds, type KeyframePacket } from '../lib/keyframe-cut.js';
import type { VideoTools } from '../lib/ffmpeg-video-tools.js';
import { NotFoundError, UnprocessableEntityError, UpstreamError, ValidationError } from '../errors/domain-errors.js';
import type { MediaFileService } from './media-file.service.js';
import type { LibraryService } from './library.service.js';

/** The one library operation trimming needs */
export type LibraryItemCreator = Pick<LibraryService, 'createItem'>;

/** Keyframes are rarely further apart than this, so the first probe stays short */
const KEYFRAME_SEARCH_WINDOW_SECONDS = 60;

const THUMBNAIL_WIDTH_PX = 480;

/**
 * Cuts the dead stretch before a script's first action off the front of its
 * video, losslessly, and saves the result as a new library item with the
 * script shifted to match. The original video and item are left untouched.
 */
export class TrimToFunscriptService {
  constructor(
    private mediaFiles: MediaFileService,
    private videoTools: VideoTools,
    private library: LibraryItemCreator,
  ) {}

  /**
   * @throws ValidationError when funscriptData is not a funscript with actions.
   * @throws NotFoundError when the video is not in the media directory.
   * @throws UnprocessableEntityError when the script starts too early to trim,
   *   or the video has no keyframe far enough in to cut at.
   * @throws UpstreamError when ffmpeg fails or the cut point can't be verified.
   * @throws ServiceUnavailableError when ffmpeg or ffprobe is not installed.
   */
  async trim(request: TrimToFunscriptRequest): Promise<TrimToFunscriptResult> {
    const funscript = this.parseFunscript(request.funscriptData);
    const sourcePath = this.mediaFiles.resolveVideoPath(request.videoName);
    if (!sourcePath) {
      throw new NotFoundError(`Video "${request.videoName}" is not in the media directory yet`);
    }

    const firstActionMs = earliestActionMs(funscript);
    const targetMs = trimCutTargetMs(firstActionMs);
    if (targetMs === null) {
      throw new UnprocessableEntityError(
        `The script starts ${formatSeconds(firstActionMs)} in, which leaves nothing to trim before its ${formatSeconds(TRIM_LEAD_IN_MS)} lead-in`,
      );
    }

    const targetSeconds = targetMs / 1000;
    const keyframes = await this.videoTools.listKeyframes(
      sourcePath,
      Math.max(0, targetSeconds - KEYFRAME_SEARCH_WINDOW_SECONDS),
      targetSeconds,
    );
    const startKeyframe = this.requireCutKeyframe(keyframes, targetSeconds);

    const outputName = this.mediaFiles.reserveVideoName(`${path.parse(sourcePath).name}-trimmed${path.extname(sourcePath)}`);
    try {
      return await this.cutAndSave(sourcePath, startKeyframe, keyframes, outputName, funscript, firstActionMs, request);
    } catch (err) {
      this.discardOutput(outputName);
      throw err;
    }
  }

  /** Best-effort cleanup, so a failed delete never hides why the trim failed */
  private discardOutput(videoName: string): void {
    try {
      this.mediaFiles.deleteVideoFile(videoName);
      this.mediaFiles.deleteThumbnailFile(videoName);
    } catch (err) {
      console.warn(`Failed to remove the partial trim ${videoName}:`, err);
    }
  }

  private async cutAndSave(
    sourcePath: string,
    startKeyframe: KeyframePacket,
    keyframes: KeyframePacket[],
    outputName: string,
    funscript: FunscriptDocument,
    firstActionMs: number,
    request: TrimToFunscriptRequest,
  ): Promise<TrimToFunscriptResult> {
    const outputPath = this.mediaFiles.videoPathFor(outputName);
    await this.videoTools.copyFromKeyframe(sourcePath, startKeyframe.ptsSeconds, outputPath);

    const cutMs = await this.measureCutMs(sourcePath, outputPath, startKeyframe, keyframes);
    if (cutMs > firstActionMs) {
      throw new UpstreamError(`The cut landed ${formatSeconds(cutMs)} in, past the script's first action`);
    }
    this.assertWorthCutting(cutMs);

    const shifted = shiftFunscriptStart(funscript, cutMs);
    await this.writeThumbnail(outputPath, outputName, (firstActionMs - cutMs) / 1000);

    const item = this.library.createItem({
      videoName: outputName,
      funscriptName: trimmedFunscriptName(request.funscriptName, outputName),
      funscriptData: JSON.stringify(shifted),
      duration: await this.videoTools.durationSeconds(outputPath),
    });
    return { item, cutMs };
  }

  /**
   * Find where the output really starts in the source, since the demuxer may
   * not have seeked to the keyframe it was asked for.
   */
  private async measureCutMs(
    sourcePath: string,
    outputPath: string,
    startKeyframe: KeyframePacket,
    keyframes: KeyframePacket[],
  ): Promise<number> {
    const outputFirst = await this.videoTools.firstKeyframe(outputPath);
    if (!outputFirst) {
      throw new UpstreamError('The trimmed video has no keyframe to verify the cut against');
    }

    const offsetSeconds =
      measureCutOffsetSeconds(keyframes, outputFirst, startKeyframe.ptsSeconds) ??
      // The demuxer landed before the search window; look from the start
      measureCutOffsetSeconds(
        await this.videoTools.listKeyframes(sourcePath, 0, startKeyframe.ptsSeconds),
        outputFirst,
        startKeyframe.ptsSeconds,
      );
    if (offsetSeconds === null) {
      throw new UpstreamError('Could not match the trimmed video back to the original to verify the cut');
    }
    return Math.round(offsetSeconds * 1000);
  }

  private requireCutKeyframe(keyframes: KeyframePacket[], targetSeconds: number): KeyframePacket {
    const keyframe = latestKeyframeAtOrBefore(keyframes, targetSeconds);
    if (keyframe === null) {
      throw noUsableKeyframeError();
    }
    this.assertWorthCutting(keyframe.ptsSeconds * 1000);
    return keyframe;
  }

  private assertWorthCutting(cutMs: number): void {
    if (cutMs < TRIM_MIN_CUT_MS) {
      throw noUsableKeyframeError();
    }
  }

  /** A missing thumbnail only leaves the library card blank, so failure is not fatal */
  private async writeThumbnail(videoPath: string, videoName: string, atSeconds: number): Promise<void> {
    try {
      await this.videoTools.captureFrame(videoPath, atSeconds, this.mediaFiles.thumbnailPathFor(videoName), THUMBNAIL_WIDTH_PX);
    } catch (err) {
      console.warn(`Failed to capture a thumbnail for ${videoName}:`, err);
      // Drop the reserved placeholder rather than serve an empty JPEG
      this.mediaFiles.deleteThumbnailFile(videoName);
    }
  }

  private parseFunscript(funscriptData: string): FunscriptDocument {
    let raw: unknown;
    try {
      raw = JSON.parse(funscriptData);
    } catch {
      throw new ValidationError('funscriptData is not valid JSON');
    }
    const result = FunscriptDocumentSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError('funscriptData must be a funscript with at least one action');
    }
    return result.data;
  }
}

function trimmedFunscriptName(funscriptName: string | null, outputVideoName: string): string {
  return funscriptName
    ? `${path.parse(funscriptName).name} (trimmed).funscript`
    : `${path.parse(outputVideoName).name}.funscript`;
}

function noUsableKeyframeError(): UnprocessableEntityError {
  return new UnprocessableEntityError(
    'The video has no keyframe far enough in to cut at without re-encoding, so it cannot be trimmed',
  );
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
