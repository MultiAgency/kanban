# ADR 0002: Use Server‑Sent Events (SSE) over WebSockets for kanban presence indicators

## Status
**Proposed** – This ADR proposes using Server‑Sent Events (SSE) as the transport for real‑time presence updates in the kanban UI. The decision is already approved for v1; this document records the rationale.

## Context
The kanban application needs to broadcast presence information (e.g., which users are viewing or editing a board) to all connected clients. Two primary web technologies can deliver server‑push updates:

- **WebSockets** – full‑duplex, bidirectional channel. Lower per‑message overhead, supports arbitrary message patterns.
- **Server‑Sent Events (SSE)** – unidirectional, server‑to‑client stream over standard HTTP. Built‑in reconnection handling and `Last‑Event‑ID` support.

Key constraints for the kanban product:
1. Presence updates are **push‑only**; clients never need to send real‑time data back over the same channel.
2. The service must be easy to self‑host for developers and hobbyists.
3. Infrastructure should work behind typical HTTP proxies, CDNs, and load balancers without special configuration.
4. Compatibility with existing CI/CD pipelines and static site generation.

## Decision
We will implement presence updates using **Server‑Sent Events**. WebSockets are not required for this use case and would add unnecessary operational complexity.

## Rationale
| Factor | SSE | WebSockets |
|--------|-----|------------|
| **Directionality** | Unidirectional (server → client) – matches our push‑only need. | Bidirectional – provides capabilities we do not currently use. |
| **Self‑host friendliness** | Works over plain HTTP/HTTPS; no upgrade handshake; compatible with most reverse proxies (NGINX, Traefik) and CDNs. | Requires `Upgrade: websocket` handshake; many proxies need explicit configuration to forward WS traffic. |
| **Reconnection** | Automatic reconnection with `Last‑Event‑ID`; client receives missed events after reconnect. | Must implement custom reconnection logic; lose in‑flight messages unless application‑level ACK. |
| **Operational overhead** | Simple HTTP endpoint; can be served by existing HTTP server stack. | Requires a separate WS server or library; more resources, separate scaling considerations. |
| **Browser support** | Widely supported in modern browsers; fallback to EventSource polyfill if needed. | Also widely supported, but older browsers may need polyfills. |
| **Message size / overhead** | Slightly higher overhead per message due to HTTP framing, but negligible for low‑frequency presence updates. | Lower per‑message overhead, but not a decisive factor for our low‑volume use case. |
| **Security** | Uses same TLS termination as regular HTTPS; no extra ports. | Typically runs on same port but may require additional firewall rules in stricter environments. |

Given that presence updates are low‑frequency, push‑only, and the primary concern is ease of deployment, SSE provides a simpler, more robust solution.

## Comparison Table
| Requirement | SSE | WebSockets |
|-------------|-----|------------|
| Push‑only updates | ✅ | ✅ |
| No special proxy config | ✅ | ❌ |
| Automatic reconnection | ✅ | ❌ (custom) |
| Minimal server changes | ✅ | ❌ (add WS handler) |
| Compatibility with static site builds | ✅ | ❌ |

## Rejected Alternatives
- **Polling** – Periodic HTTP GET would increase latency and load; not real‑time enough for presence.
- **WebSockets** – Provides bidirectional capability we do not need and introduces deployment friction.
- **Long‑Polling / HTTP2 Server Push** – More complex to implement and less widely supported across CDNs.

## Consequences
- **Positive**: Simpler deployment pipeline; developers can run the service locally without extra configuration.
- **Negative**: If future features require bidirectional communication (e.g., collaborative editing), we will need to introduce WebSockets or another channel.
- **Mitigation**: Design the presence service as a thin abstraction layer so that switching to WebSockets later is straightforward.

## References
- MDN Web Docs – [Server‑Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- RFC 6455 – The WebSocket Protocol
- GitHub Issue #40 – ADR: SSE over WebSockets rationale
- Kanban convention SPEC §Convention (labels, handoff format)
