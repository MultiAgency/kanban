# ADR 0005: GitHub‑sync as first‑class v1 feature

**Status:** Proposed

## Context

The v0 convention lives entirely on GitHub Issues.  Teams adopting v1 expect a seamless migration path without abandoning existing data.  The product vision requires bidirectional synchronization between the app and GitHub so that users can work in either interface.

## Decision

Implement GitHub‑sync as a first‑class feature in v1.  The sync will be **bidirectional** and **authoritative‑side configurable** (see Issue #27).  Projects can opt into `sync-mode` which enables both inbound webhooks and outbound pull‑mode reconciliation.

## Rationale

* **User continuity** – existing v0 users keep their issue history.
* **Adoption barrier** – without sync, teams would need to migrate data manually.
* **Competitive parity** – other Kanban tools offer two‑way sync with GitHub.

## Comparison Table

| Feature | Our Approach | Competitor A | Competitor B |
|---|---|---|---|
| Bidirectional sync | Configurable authoritative side | Unidirectional import only | Bidirectional but limited to comments |
| Conflict resolution | Pluggable rules (see #27) | Last‑write‑wins | Manual merge UI |
| Rate‑limit handling | Adaptive back‑off, chunked pulls | No back‑off, may hit limits | Uses GitHub GraphQL for higher limits |

## Rejected Alternatives

* **Defer sync to v1.5** – would force existing users to re‑enter data, violating the durability commitment.
* **Sync‑only inbound** – would not satisfy the need for app‑driven updates (e.g., task state changes).

## Consequences

* Adds complexity to the backend (webhook verification, pull worker, conflict logic).
* Requires additional permissions (`repo` scope) for the service account.
* Enables future features such as automated issue linking and status dashboards.

## References

* Issue #20 – GitHub‑sync mechanics
* Issue #27 – Conflict resolution rules
* GitHub REST API docs – [Issues](https://docs.github.com/rest/issues/issues)
