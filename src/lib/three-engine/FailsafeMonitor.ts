import * as Sentry from '@sentry/nextjs';

export class FailsafeMonitor {
  private frameTimes: number[] = [];
  private readonly maxFramesToTrack = 60;
  private readonly criticalFpsThreshold = 30;
  private timeBelowThreshold = 0;
  private readonly degradationTimeLimit = 2.0; // seconds

  private isDegraded = false;
  private reportedToSentry = false;

  public checkHealth(delta: number): boolean {
    if (this.isDegraded) return false;

    // Delta is the time in seconds since the last frame
    // Prevent division by zero, and huge deltas if user switches tabs
    if (delta === 0 || delta > 0.5) return true;

    const fps = 1.0 / delta;

    this.frameTimes.push(fps);
    if (this.frameTimes.length > this.maxFramesToTrack) {
      this.frameTimes.shift();
    }

    // Calculate moving average
    const avgFps = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    if (avgFps < this.criticalFpsThreshold) {
      this.timeBelowThreshold += delta;

      if (this.timeBelowThreshold >= this.degradationTimeLimit) {
        this.triggerDegradation(avgFps);
        return false;
      }
    } else {
      // Recovery logic
      this.timeBelowThreshold = Math.max(0, this.timeBelowThreshold - delta * 2);
    }

    return true; // Healthy, keep rendering at max fidelity
  }

  private triggerDegradation(recordedFps: number) {
    this.isDegraded = true;

    if (!this.reportedToSentry) {
      // Send telemetry back to server-log dashboards regarding hardware limitations
      Sentry.captureMessage('Hardware Performance Degraded: WebGL Post-Processing Disabled', {
        level: 'warning',
        tags: { performance: 'critical_fps_drop' },
        extra: {
          recordedFps: recordedFps.toFixed(1),
          threshold: this.criticalFpsThreshold
        }
      });
      this.reportedToSentry = true;
    }
    
    console.warn(`[FailsafeMonitor] Average FPS dropped to ${recordedFps.toFixed(1)}. Disabling heavy post-processing.`);
  }

  public get isHealthy(): boolean {
    return !this.isDegraded;
  }
}
