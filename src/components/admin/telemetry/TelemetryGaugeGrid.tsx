'use client';

import { TelemetryGauge } from './TelemetryGauge';
import Sparkline from './Sparkline';

interface TelemetryGaugeGridProps {
  healthScore: number;
  memoryMB: number;
  memoryTotalMB: number;
  avgResponseMs: number;
  totalRequests: number;
  uptimeSeconds: number;
  totalSleeps: number;
  errorRate: number;
}

export function TelemetryGaugeGrid({
  healthScore, memoryMB, memoryTotalMB, avgResponseMs,
  totalRequests, uptimeSeconds, totalSleeps, errorRate,
}: TelemetryGaugeGridProps) {
  const memoryPct = memoryTotalMB > 0 ? Math.round((memoryMB / memoryTotalMB) * 100) : 0;
  const reqPerMin = uptimeSeconds > 60 ? Math.round(totalRequests / (uptimeSeconds / 60)) : totalRequests;
  const uptimePct = uptimeSeconds > 0
    ? Math.round((uptimeSeconds / (uptimeSeconds + totalSleeps * 60)) * 100)
    : 0;

  // Placeholder sparkline data based on current gauge values (UI framework; real data requires VPS API enhancement)
  const healthSparkline = Array.from({ length: 24 }, () => healthScore * (0.85 + Math.random() * 0.3));
  const memorySparkline = Array.from({ length: 24 }, () => memoryPct * (0.85 + Math.random() * 0.3));
  const responseSparkline = Array.from({ length: 24 }, () => Math.round(avgResponseMs) * (0.85 + Math.random() * 0.3));
  const trafficSparkline = Array.from({ length: 24 }, () => reqPerMin * (0.85 + Math.random() * 0.3));
  const uptimeSparkline = Array.from({ length: 24 }, () => uptimePct * (0.85 + Math.random() * 0.3));
  const errorSparkline = Array.from({ length: 24 }, () => Math.round(errorRate) * (0.85 + Math.random() * 0.3));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={healthScore} max={100} label="System Health" unit="%"
          thresholds={{ green: 80, amber: 50 }} inverted
          sublabel={healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'Fair' : 'Critical'}
        />
        <Sparkline data={healthSparkline} label="System Health" color="#22c55e" />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={memoryPct} max={100} label="Memory Usage" unit="%"
          thresholds={{ green: 60, amber: 85 }}
          sublabel={`${memoryMB}MB / ${memoryTotalMB}MB`}
        />
        <Sparkline data={memorySparkline} label="Memory Usage" color="#f59e0b" />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={Math.round(avgResponseMs)} max={1000} label="Avg Response" unit="ms"
          thresholds={{ green: 200, amber: 500 }}
          sublabel={avgResponseMs <= 200 ? 'Fast' : avgResponseMs <= 500 ? 'Moderate' : 'Slow'}
        />
        <Sparkline data={responseSparkline} label="Avg Response" color="#C9A84C" />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={reqPerMin} max={Math.max(reqPerMin * 2, 100)} label="Traffic" unit=" rpm"
          thresholds={{ green: 999, amber: 9999 }}
          sublabel={`${totalRequests} total requests`}
        />
        <Sparkline data={trafficSparkline} label="Traffic" color="#C9A84C" />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={uptimePct} max={100} label="Agent Uptime" unit="%"
          thresholds={{ green: 90, amber: 70 }} inverted
          sublabel={`${totalSleeps} sleep cycles`}
        />
        <Sparkline data={uptimeSparkline} label="Agent Uptime" color="#22c55e" />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={Math.round(errorRate)} max={100} label="Error Rate" unit="%"
          thresholds={{ green: 0, amber: 20 }}
          sublabel={errorRate === 0 ? 'All clear' : `${Math.round(errorRate)}% failing`}
          tooltip="Percentage of API responses returning HTTP 5xx status codes in the last 60 minutes"
        />
        <Sparkline data={errorSparkline} label="Error Rate" color="#ef4444" />
      </div>
    </div>
  );
}
