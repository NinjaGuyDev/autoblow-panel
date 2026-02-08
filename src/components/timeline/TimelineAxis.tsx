import React, { useMemo } from 'react';

interface TimelineAxisProps {
  viewStart: number;
  viewEnd: number;
  width: number;
  height?: number;
}

interface TickConfig {
  interval: number;
  formatter: (ms: number) => string;
}

/**
 * Format milliseconds to M:SS format
 */
function formatMinutesSeconds(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to M:SS.s format
 */
function formatWithTenths(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

/**
 * Format milliseconds to S.ss format
 */
function formatSecondsHundredths(ms: number): string {
  const seconds = ms / 1000;
  return seconds.toFixed(2);
}

/**
 * Format milliseconds to S.sss format
 */
function formatSecondsMilliseconds(ms: number): string {
  const seconds = ms / 1000;
  return seconds.toFixed(3);
}

export const TimelineAxis = React.memo<TimelineAxisProps>(
  ({ viewStart, viewEnd, width, height = 28 }) => {
    const duration = viewEnd - viewStart;

    // Determine tick configuration based on viewport duration
    const tickConfig = useMemo((): TickConfig => {
      if (duration > 60000) {
        // > 1 minute: ticks every 10s, M:SS format
        return { interval: 10000, formatter: formatMinutesSeconds };
      } else if (duration > 10000) {
        // > 10s: ticks every 2s, M:SS format
        return { interval: 2000, formatter: formatMinutesSeconds };
      } else if (duration > 5000) {
        // > 5s: ticks every 1s, M:SS.s format
        return { interval: 1000, formatter: formatWithTenths };
      } else if (duration > 2000) {
        // > 2s: ticks every 500ms, S.ss format
        return { interval: 500, formatter: formatSecondsHundredths };
      } else {
        // <= 2s: ticks every 100ms, S.sss format
        return { interval: 100, formatter: formatSecondsMilliseconds };
      }
    }, [duration]);

    // Calculate tick positions
    const ticks = useMemo(() => {
      const result: Array<{ position: number; label: string }> = [];

      // Start from first tick after viewStart
      const firstTick = Math.ceil(viewStart / tickConfig.interval) * tickConfig.interval;

      for (let time = firstTick; time <= viewEnd; time += tickConfig.interval) {
        const position = ((time - viewStart) / duration) * width;
        const label = tickConfig.formatter(time);
        result.push({ position, label });
      }

      return result;
    }, [viewStart, viewEnd, width, duration, tickConfig]);

    return (
      <div
        className="relative text-xs text-muted-foreground"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {ticks.map((tick, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              left: `${tick.position}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Tick mark */}
            <div className="w-px h-1 bg-current opacity-40 mx-auto" />
            {/* Label */}
            <div className="mt-0.5 text-center whitespace-nowrap">{tick.label}</div>
          </div>
        ))}
      </div>
    );
  }
);

TimelineAxis.displayName = 'TimelineAxis';
