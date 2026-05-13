# ADR 0002: v1 repo placement

## Status
Accepted

## Context
The v1 application source needs a location that balances clean separation for downstream users who only want the kanban convention with shared utilities like `parseHandoff`. Three options were considered:

a) Add a `v1/` directory to this repo.

b) Create a new repository `MultiAgency/kanban-app`.

c) Use a monorepo with workspaces.

## Decision
We choose **option (b): a new repository `MultiAgency/kanban-app`**.

## Rationale
- **Clean separation**: The template repository remains lightweight for forking. Users who only need the convention won’t inherit v1 source.
- **Independent release cadence**: The app can be versioned and released independently of the template.
- **Shared utilities**: `parseHandoff` and other helpers can be published as an npm package, allowing both repos to consume them without coupling.
- **Future extensibility**: Adding additional integrations later will not bloat the template repo.

## Consequences
- A new repo must be created and CI/CD set up for the v1 app.
- Documentation will reference the new repo URL.
- Migration steps: copy any existing v1‑related files from this repo into the new one and update imports to the npm package.

## References
- Issue #2 (this ADR)
- Existing ADRs for architecture decisions.
