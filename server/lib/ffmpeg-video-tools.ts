import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ServiceUnavailableError, UpstreamError } from '../errors/domain-errors.js';
import type { KeyframePacket } from './keyframe-cut.js';

/**
 * Runs an external program and resolves with its stdout.
 * @throws ServiceUnavailableError when the program is not installed.
 * @throws UpstreamError when it exits with an error.
 */
export type CommandRunner = (command: string, args: string[]) => Promise<string>;

/** Video operations the trim feature needs, independent of the tool behind them */
export interface VideoTools {
  /** Keyframe packets of the first video stream shown between fromSeconds and toSeconds */
  listKeyframes(videoPath: string, fromSeconds: number, toSeconds: number): Promise<KeyframePacket[]>;
  /** The first keyframe packet of the first video stream, or null when there is none */
  firstKeyframe(videoPath: string): Promise<KeyframePacket | null>;
  /** Stream-copy everything from the keyframe at startSeconds to the end, overwriting outputPath */
  copyFromKeyframe(videoPath: string, startSeconds: number, outputPath: string): Promise<void>;
  /** Container duration in seconds, or null when the file doesn't report one */
  durationSeconds(videoPath: string): Promise<number | null>;
  /** Write one frame as a JPEG scaled to widthPx, overwriting outputPath */
  captureFrame(videoPath: string, atSeconds: number, outputPath: string, widthPx: number): Promise<void>;
}

/**
 * Seek this far past the keyframe so microsecond rounding in the printed
 * timestamp can't make the demuxer pick the keyframe before it. The real
 * offset is measured afterwards, so this only steers the seek.
 */
const SEEK_PAST_KEYFRAME_SECONDS = 0.001;

/** Packet listings of long lead-ins run to a few MB of JSON */
const MAX_STDOUT_BYTES = 256 * 1024 * 1024;

interface ProbedPacket {
  pts_time?: string;
  flags?: string;
  data_hash?: string;
}

/**
 * VideoTools backed by the ffmpeg and ffprobe executables.
 * Every method can throw the errors documented on CommandRunner.
 */
export class FfmpegVideoTools implements VideoTools {
  constructor(
    private ffmpegPath: string,
    private ffprobePath: string,
    private run: CommandRunner,
  ) {}

  async listKeyframes(videoPath: string, fromSeconds: number, toSeconds: number): Promise<KeyframePacket[]> {
    return this.probeKeyframes(videoPath, `${fromSeconds}%${toSeconds}`);
  }

  async firstKeyframe(videoPath: string): Promise<KeyframePacket | null> {
    // Reordered streams can open with a few non-key packets before the keyframe
    const [first] = await this.probeKeyframes(videoPath, '%+#8');
    return first ?? null;
  }

  async copyFromKeyframe(videoPath: string, startSeconds: number, outputPath: string): Promise<void> {
    await this.run(this.ffmpegPath, [
      '-v', 'error',
      '-y',
      '-ss', String(startSeconds + SEEK_PAST_KEYFRAME_SECONDS),
      '-i', videoPath,
      '-map', '0:v', '-map', '0:a?',
      '-c', 'copy',
      '-map_metadata', '0',
      // Shift every stream by the same amount so the output starts at zero
      // and audio stays aligned with video
      '-avoid_negative_ts', 'make_zero',
      outputPath,
    ]);
  }

  async durationSeconds(videoPath: string): Promise<number | null> {
    const stdout = await this.run(this.ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      videoPath,
    ]);
    const duration = Number((JSON.parse(stdout) as { format?: { duration?: string } }).format?.duration);
    return Number.isFinite(duration) ? duration : null;
  }

  async captureFrame(videoPath: string, atSeconds: number, outputPath: string, widthPx: number): Promise<void> {
    await this.run(this.ffmpegPath, [
      '-v', 'error',
      '-y',
      '-ss', String(atSeconds),
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', `scale=${widthPx}:-2`,
      '-q:v', '4',
      outputPath,
    ]);
  }

  private async probeKeyframes(videoPath: string, readIntervals: string): Promise<KeyframePacket[]> {
    const stdout = await this.run(this.ffprobePath, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-read_intervals', readIntervals,
      '-show_entries', 'packet=pts_time,flags,data_hash',
      '-show_data_hash', 'MD5',
      '-of', 'json',
      videoPath,
    ]);
    const packets = (JSON.parse(stdout) as { packets?: ProbedPacket[] }).packets ?? [];
    return packets.flatMap(packet => {
      const ptsSeconds = Number(packet.pts_time);
      const isKeyframe = packet.flags?.startsWith('K') === true;
      return isKeyframe && Number.isFinite(ptsSeconds) && packet.data_hash
        ? [{ ptsSeconds, dataHash: packet.data_hash }]
        : [];
    });
  }
}

const execFileAsync = promisify(execFile);

/** CommandRunner over child_process.execFile; arguments never pass through a shell */
export const runCommand: CommandRunner = async (command, args) => {
  try {
    const { stdout } = await execFileAsync(command, args, { maxBuffer: MAX_STDOUT_BYTES });
    return stdout;
  } catch (err: unknown) {
    const failure = err as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === 'ENOENT') {
      throw new ServiceUnavailableError(`${command} is not installed or not on PATH`);
    }
    const detail = failure.stderr?.trim().split('\n').at(-1) ?? failure.message;
    throw new UpstreamError(`${command} failed: ${detail}`);
  }
};
