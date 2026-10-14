/** What the Dashboard knows about the systems: the agent server's health, the page checks and the issues found from them. */

export interface ServerHealth {
  version: string;
  nodeVersion: string;
  uptime: number;
  agentStatus: 'awake' | 'sleeping';
  idleSeconds: number;
  sleepTimeoutSeconds: number;
  totalRequests: number;
  totalSleeps: number;
  totalWakes: number;
  productionApproved: boolean;
  memoryMB: number;
  memoryTotalMB: number;
}

export interface HealthData {
  type: 'health';
  server: ServerHealth;
  models: string[];
  modelCount: number;
  tools: string[];
  toolCount: number;
  workspace: { loaded: boolean; files: string[]; fileCount: number };
  apiKeys: Record<string, boolean>;
  costLimit: number;
  developer: string;
  timestamp: string;
  autoSleep?: {
    enabled: boolean;
    warningActive: boolean;
    secondsUntilSleep: number;
    thresholdSeconds: number;
    warningStartsAtSeconds: number;
  };
}

export interface PageCheck {
  path: string;
  name: string;
  status: 'pass' | 'fail' | 'checking';
  responseTime: number;
  statusCode: number;
}

export interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  fix: string;
  aiPrompt: string;
}

export interface ActionResult {
  action: string;
  success: boolean;
  message: string;
}
