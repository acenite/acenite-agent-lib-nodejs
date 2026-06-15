export type AceniteFramework = "express";
export type AceniteInstrumentation = "http";

export interface AceniteAgentConfig {
  app?: object | null;
  framework?: AceniteFramework;
  instrumentations?: AceniteInstrumentation[];
  apiKey: string;
  serviceName?: string;
  enableLogging?: boolean;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
}

