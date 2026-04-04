'use client';

import { TelemetryGauge } from './TelemetryGauge';

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={healthScore} max={100} label="System Health" unit="%"
          thresholds={{ green: 80, amber: 50 }} inverted
          sublabel={healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'Fair' : 'Critical'}
        />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={memoryPct} max={100} label="Memory Usage" unit="%"
          thresholds={{ green: 60, amber: 85 }}
          sublabel={`${memoryMB}MB / ${memoryTotalMB}MB`}
        />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={Math.round(avgResponseMs)} max={1000} label="Avg Response" unit="ms"
          thresholds={{ green: 200, amber: 500 }}
          sublabel={avgResponseMs <= 200 ? 'Fast' : avgResponseMs <= 500 ? 'Moderate' : 'Slow'}
        />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={reqPerMin} max={Math.max(reqPerMin * 2, 100)} label="Traffic" unit=" rpm"
          thresholds={{ green: 999, amber: 9999 }}
          sublabel={`${totalRequests} total requests`}
        />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={uptimePct} max={100} label="Agent Uptime" unit="%"
          thresholds={{ green: 90, amber: 70 }} inverted
          sublabel={`${totalSleeps} sleep cycles`}
        />
      </div>
      <div className="flex flex-col items-center">
        <TelemetryGauge
          value={Math.round(errorRate)} max={100} label="Error Rate" unit="%"
          thresholds={{ green: 0, amber: 20 }}
          sublabel={errorRate === 0 ? 'All clear' : `${Math.round(errorRate)}% failing`}
          tooltip="Percentage of API responses returning HTTP 5xx status codes in the last 60 minutes"
        />
      </div>
    </div>
  );
}
