# Acenite Agent (Node.js)

Official Node.js/TypeScript agent library for the Acenite server monitoring platform.

This package mirrors the public behavior of the Acenite Python agent: OpenTelemetry tracing bootstrap, heartbeat monitoring, and a small class-based startup API.

## Installation

```sh
npm install acenite-agent-lib-nodejs
```

## Usage

Create `instrumentation.ts` and load it before importing Express or `node:http`:

```ts
import { AceniteAgent } from "acenite-agent-lib-nodejs";
AceniteAgent.start({
  framework: "express",
  apiKey: process.env.ACENITE_API_KEY!,
  serviceName: "orders-service",
  enableApplicationMonitoring: true,
  enableHeartbeat: true,
  enableHostMetrics: true,
});
```

Import `./instrumentation.js` first in the server entrypoint. Use `framework: "http"` for built-in Node.js HTTP.

The existing function-style entrypoint is also available:

```ts
import { start } from "acenite-agent-lib-nodejs";

start({
  apiKey: "your-api-key",
  serviceName: "orders-service",
});
```

## Configuration

```ts
interface AceniteAgentConfig {
  apiKey: string;
  app?: object | null;
  framework?: "express" | "http";
  instrumentations?: "http"[];
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
```

Defaults:

- `serviceName`: `"unknown-service"`
- `enableLogging`: `true`
- `enableHeartbeat`: `true`
- `heartbeatInterval`: `60`
- `enableHostMetrics`: `true`
- `hostMetricsInterval`: `60`
- `hostname`: operating system hostname
- `instanceId`: `hostname`

## Behavior

- Traces are exported to `https://ingest.acenite.com/monitor/` by default.
- Heartbeats are sent to `https://ingest.acenite.com/heartbeat/` by default.
- Requests use the `Authorization: Bearer <apiKey>` header.
- Heartbeat payloads include `status`, `boot_id`, and `instance_id`, matching the Python agent.
- Host resource metrics are sent to `https://ingest.acenite.com/metrics/host` by default.
- Host metric network fields, `network_rx_bytes` and `network_tx_bytes`, are cumulative counters. The Acenite backend calculates deltas/rates for charts.
- `AceniteAgent.start(...)` is idempotent.
- `AceniteAgent.stop()` clears both background intervals and shuts down tracing.
- `AceniteAgent.getTracer()` and the exported `getTracer()` provide manual spans.
