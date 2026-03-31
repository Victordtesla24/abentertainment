/** Quality tiers ordered from best to worst */
export type QualityTier = 'full' | 'reduced' | 'minimal' | 'fallback';

const TIER_ORDER: QualityTier[] = ['full', 'reduced', 'minimal', 'fallback'];

export interface QualitySettings {
  shadowsEnabled: boolean;
  pixelRatio: number;
}

function getTierSettings(): Record<QualityTier, QualitySettings> {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;
  return {
    full: { shadowsEnabled: true, pixelRatio: dpr },
    reduced: { shadowsEnabled: false, pixelRatio: 1.5 },
    minimal: { shadowsEnabled: false, pixelRatio: 1 },
    fallback: { shadowsEnabled: false, pixelRatio: 1 },
  };
}

export class FailsafeMonitor {
  private frameTimes: number[] = [];
  private readonly maxFramesToTrack = 60;
  private readonly criticalFpsThreshold = 30;
  private readonly recoveryFpsThreshold = 50;
  private timeBelowThreshold = 0;
  private readonly degradationTimeLimit = 2.0; // seconds

  // Current quality tier
  private currentTierIndex = 0; // 0 = full
  private reportedToSentry = false;

  // Hysteresis: require 3 consecutive bad/good measurement windows before changing
  private readonly hysteresisCount = 3;
  private declineStreak = 0;
  private inclineStreak = 0;

  // Measurement windows — each window is one full frameTimes buffer cycle
  private windowSampleCount = 0;

  public checkHealth(delta: number): boolean {
    // Delta is the time in seconds since the last frame
    // Prevent division by zero, and huge deltas if user switches tabs
    if (delta === 0 || delta > 0.5) return this.currentTier !== 'fallback';

    const fps = 1.0 / delta;

    this.frameTimes.push(fps);
    if (this.frameTimes.length > this.maxFramesToTrack) {
      this.frameTimes.shift();
    }

    this.windowSampleCount++;

    // Only evaluate at end of each measurement window (every maxFramesToTrack samples)
    if (this.windowSampleCount >= this.maxFramesToTrack) {
      this.windowSampleCount = 0;
      this.evaluateWindow();
    }

    // Legacy cumulative degradation — fast path to fallback for sustained terrible FPS
    const avgFps = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    if (avgFps < this.criticalFpsThreshold) {
      this.timeBelowThreshold += delta;
      if (this.timeBelowThreshold >= this.degradationTimeLimit && this.currentTier !== 'fallback') {
        this.downgrade();
      }
    } else {
      this.timeBelowThreshold = Math.max(0, this.timeBelowThreshold - delta * 2);
    }

    return this.currentTier !== 'fallback';
  }

  /** Evaluate one full measurement window and update hysteresis streaks */
  private evaluateWindow() {
    if (this.frameTimes.length === 0) return;
    const avgFps = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    if (avgFps < this.criticalFpsThreshold) {
      // Bad window
      this.declineStreak++;
      this.inclineStreak = 0;

      if (this.declineStreak >= this.hysteresisCount) {
        this.downgrade();
        this.declineStreak = 0;
      }
    } else if (avgFps > this.recoveryFpsThreshold) {
      // Good window — candidate for upgrade
      this.inclineStreak++;
      this.declineStreak = 0;

      if (this.inclineStreak >= this.hysteresisCount) {
        this.upgrade();
        this.inclineStreak = 0;
      }
    } else {
      // Neutral window — reset both streaks (no flapping)
      this.declineStreak = 0;
      this.inclineStreak = 0;
    }
  }

  /** Degrade one quality tier */
  private downgrade() {
    if (this.currentTierIndex >= TIER_ORDER.length - 1) return; // Already at worst

    this.currentTierIndex++;
    const tier = this.currentTier;

    if (!this.reportedToSentry) {
      // TODO: Add monitoring/telemetry when a provider is configured
      this.reportedToSentry = true;
    }

    const avgFps = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;

    console.warn(
      `[FailsafeMonitor] Downgraded to "${tier}" (avg FPS: ${avgFps.toFixed(1)}).`
    );

    this.applyTierSettings();
  }

  /** Upgrade one quality tier if performance is consistently good */
  private upgrade() {
    if (this.currentTierIndex <= 0) return; // Already at best

    this.currentTierIndex--;
    const tier = this.currentTier;

    const avgFps = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;

    console.info(
      `[FailsafeMonitor] Upgraded to "${tier}" (avg FPS: ${avgFps.toFixed(1)}).`
    );

    this.applyTierSettings();
  }

  /** Dispatch an event so the engine/renderer can apply the new quality settings */
  private applyTierSettings() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('quality-tier-changed', {
          detail: {
            tier: this.currentTier,
            settings: this.qualitySettings,
          },
        })
      );
    }
  }

  /** Current quality tier name */
  public get currentTier(): QualityTier {
    return TIER_ORDER[this.currentTierIndex];
  }

  /** Current quality settings for the active tier */
  public get qualitySettings(): QualitySettings {
    return getTierSettings()[this.currentTier];
  }

  public get isHealthy(): boolean {
    return this.currentTier !== 'fallback';
  }

  /** True if quality has been degraded from full (but not yet at fallback) */
  public get isDegraded(): boolean {
    return this.currentTierIndex > 0;
  }
}
