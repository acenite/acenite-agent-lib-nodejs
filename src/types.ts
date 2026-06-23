export type AceniteFramework = "express" | "http";
export type AceniteInstrumentation = "http";

export interface AceniteAgentConfig {
  app?: object | null;
  framework?: AceniteFramework;
  instrumentations?: AceniteInstrumentation[];
  apiKey: string;
  serviceName?: string;
  enableLogging?: boolean;
  enableApplicationMonitoring?: boolean;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  enableHostMetrics?: boolean;
  hostMetricsInterval?: number;
  instanceId?: string;
  hostname?: string;
}
