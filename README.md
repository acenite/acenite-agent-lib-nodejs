# Acenite Agent (Node.js)

Official Node.js/TypeScript agent library for the Acenite server monitoring platform.

This package mirrors the public behavior of the Acenite Python agent: OpenTelemetry tracing bootstrap, heartbeat monitoring, and a small class-based startup API.

## Installation

```sh
npm install acenite-agent-lib-nodejs
```

## Usage

```ts
import express from "express";
import { AceniteAgent } from "acenite-agent-lib-nodejs";

const app = express();

AceniteAgent.start({
  app,
  framework: "express",
  apiKey: "your-api-key",
  serviceName: "orders-service",
  instrumentations: ["http"],
});
```

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
  framework?: "express";
  instrumentations?: "http"[];
  serviceName?: string;
  enableLogging?: boolean;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
}
```

Defaults:

- `serviceName`: `"unknown-service"`
- `enableLogging`: `true`
- `enableHeartbeat`: `true`
- `heartbeatInterval`: `60`

## Behavior

- Traces are exported to `http://localhost:8000/server/monitor/`.
- Heartbeats are sent to `http://localhost:8000/server/heartbeat/`.
- Requests use the `Authorization: Bearer <apiKey>` header.
- Heartbeat payloads include `status`, `boot_id`, and `instance_id`, matching the Python agent.
- `AceniteAgent.start(...)` is idempotent.
- `AceniteAgent.stop()` clears the heartbeat interval and shuts down tracing.
