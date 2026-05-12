# ADR 0003: SQLite-default rationale

## Status
Proposed

## Context
Write the ADR for SQLite-default + Postgres-opt-in. The decision is already made — v1 uses SQLite by default; setting `DATABASE_URL=postgres` switches to managed Postgres without code changes. The portability constraint that makes this seamless is documented in #5.

## Decision
- Default database is SQLite.
- Setting `DATABASE_URL=postgres` switches to Postgres without code changes.
- This provides zero�$dependency, single�$file database for solo deployers, while allowing multi�$tenant deployments to use Postgres for higher concurrency, advanced indexing, and full—text search.

## Consequences
- **Self‑host friendliness**: SQLite requires no external service, easy backup via file copy.
- **Portability constraint**: To support both dialects we avoid Postgres‑specific features (e.g., JSONB operators, custom types).
- **When to use Postgres**: Multa—tenant, high—write load, advanced indexing (GIN, GiST), full‑text search beyond SQLite's FTS5.
- **Migration**: Switching via `DATABASE_URL` requires no code changes; migration scripts run on both databases.
