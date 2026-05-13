# ADR 0002: OpenAPI Generation Tooling

## Status
**Proposed** – This ADR documents the recommended approach for generating and serving the OpenAPI specification for v1 of the Kanban application.

## Context
The Kanban service needs a machine‑readable OpenAPI spec for API consumers, documentation generators, and potential client SDK generation. The chosen web framework for v1 is **Hono** (see issue #1). The tooling must integrate cleanly with Hono, be maintainable, and have minimal runtime overhead.

### Options evaluated
1. **Hand‑authored YAML** (`docs/api/openapi.yaml`)
   - *Pros*: Complete control, no build‑time dependencies.
   - *Cons*: Manual sync required whenever routes change; high maintenance burden; error‑prone.
2. **Generated from route‑handler annotations**
   - Hono provides `@hono/zod-openapi` which can generate OpenAPI definitions from Zod schemas attached to route handlers.
   - Fastify has a built‑in OpenAPI plugin.
   - *Pros*: Keeps spec close to code; automatic updates on route changes.
   - *Cons*: Requires developers to write Zod schemas for each route; adds a small compile‑time dependency.
3. **Generated from Zod schemas** (`zod-openapi` library)
   - Independent of framework; Zod schemas are defined once and can be reused for validation and OpenAPI generation.
   - *Pros*: Framework‑agnostic; encourages strong typing.
   - *Cons*: Additional glue code needed to map schemas to routes; may duplicate effort if Hono already provides annotation support.

## Decision
We will generate the OpenAPI spec **from Hono route‑handler annotations using `@hono/zod-openapi`**. This aligns with the selected framework, keeps the spec close to implementation, and requires only a modest addition of Zod schemas to existing handlers.

## Rationale
| Criterion | Hand‑authored YAML | Annotation generation (Hono) | Zod‑only generation |
|-----------|-------------------|-----------------------------|----------------------|
| **Sync with code** | Manual, high risk of drift | Automatic via annotations | Automatic but extra mapping layer |
| **Runtime overhead** | None (static file) | Minimal (generation at build time) | Minimal (generation at build time) |
| **Developer effort** | High (keep file updated) | Moderate (add Zod schemas to handlers) | Moderate‑high (maintain separate schema files) |
| **Tooling ecosystem** | Standard OpenAPI tools work | `@hono/zod-openapi` is maintained and integrates with Hono | `zod-openapi` is mature, but requires extra glue |
| **Future flexibility** | Easy to replace, but costly to maintain | Works for Hono; switching frameworks will need new generator |
| **License compatibility** | MIT/Apache‑2.0 compatible | MIT (Hono) + BSD‑3 (Zod) compatible |

The annotation approach offers the best trade‑off between correctness and developer overhead for the current stack.

## Rejected Alternatives
- **Hand‑authored YAML** – While simple, the manual sync cost is unacceptable for a fast‑moving codebase.
- **Pure Zod generation** – Adds an unnecessary indirection layer when Hono already supports the same pattern directly.
- **Fastify plugin** – Not applicable because the framework is Hono.
- **Express‑specific solutions** – Irrelevant given the Hono selection.

## Consequences
- **Positive**: The OpenAPI spec will always reflect the actual routes and request/response shapes, reducing documentation bugs.
- **Negative**: Developers must write and maintain Zod schemas for each endpoint, which adds a small learning curve.
- **Mitigation**: Provide a template for route definition and a lint rule that warns when a route lacks a Zod schema.

## References
- Hono documentation – `@hono/zod-openapi` integration: https://hono.dev/docs/middleware/zod-openapi
- Zod‑OpenAPI library: https://github.com/astea/zod-openapi
- OpenAPI Specification v3.1: https://spec.openapis.org/oas/v3.1.0
- Issue #1 (framework selection) – https://github.com/MultiAgency/kanban/issues/1
- Issue #16 – this ADR
