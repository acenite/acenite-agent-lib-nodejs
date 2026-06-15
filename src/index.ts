export { AceniteAgent } from "./agent";
export { sendHeartbeat } from "./heartbeat";
export type {
  AceniteAgentConfig,
  AceniteFramework,
  AceniteInstrumentation,
} from "./types";

import { AceniteAgent } from "./agent";
import type { AceniteAgentConfig } from "./types";

export function start(config: AceniteAgentConfig): void {
  AceniteAgent.start(config);
}

export function stop(): Promise<void> {
  return AceniteAgent.stop();
}

