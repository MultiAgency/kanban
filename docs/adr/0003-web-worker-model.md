# ADR: Web/Worker Process Model

**Status:** Proposed

**Context:**
The application can be deployed as a single Docker image. It needs to support two roles:
- **Web server** – serves HTTP API and UI.
- **Worker** – processes background jobs such as the cron‑pull sync and async job queue.

**Decision:**
We will implement entry‑point commands to select the role:
```bash
docker run <image> web    # starts the HTTP server
docker run <image> worker # starts the background worker
```
The same image contains both binaries (or the same binary with a mode flag). This avoids maintaining separate images and simplifies CI/CD.

**Rationale:**
- Deployments that only need the web component avoid unnecessary worker processes, reducing resource usage.
- Sync‑mode projects that cannot expose public webhooks require the worker for periodic pull; the same image can be used.
- Health‑check endpoint `/healthz` will report role‑specific status.
- Graceful shutdown handling (SIGTERM) will ensure in‑flight jobs are finished and claims released.

**Consequences:**
- CI must test both `web` and `worker` modes.
- Documentation must describe the command‑line interface.
- Configuration via environment variables applies to both modes.

**References:**
- Issue #1 (framework choice) – influences middleware for health checks.
- Issue #20 (GitHub‑sync mechanics) – worker runs the pull cron.
