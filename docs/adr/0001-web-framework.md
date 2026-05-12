# ADR 0001: Web Framework Choice - Hono

## Status

Accepted

## Context

The v1 application requires a production-grade TypeScript web framework for building APIs and server-side applications. Three candidates were evaluated: **Hono**, **Fastify**, and **Express**. The decision is pre-resolved to Hono; this ADR documents the substantive rationale defending that choice on technical merits.

## Decision

**Hono** is selected as the v1 web framework.

## Rationale

### TypeScript Inference Quality

Hono provides superior TypeScript type inference compared to both Fastify and Express. Its design treats types as first-class citizens rather than an afterthought.

**Hono's strengths:**
- Route handlers receive properly typed `c.req` objects with inferred parameter, query, and body types based on route definition
- Type-safe middleware composition with context propagation that preserves types through the chain
- No need for external type plugins—the framework core includes full type definitions
- Path parameter extraction (`c.req.param()`) is automatically typed from the route pattern

**Fastify's approach:**
- Requires `@fastify/type-provider-typebox` or similar plugins for schema-based type inference
- Type safety is contingent on using JSON Schema validators; without them, requests are `any`
- More verbose setup for equivalent type safety
- Schema-first design means you must define schemas before gaining type benefits

**Express's limitations:**
- Originally designed for JavaScript; TypeScript support is community-maintained via `@types/express`
- No built-in type inference for request parameters or bodies
- Developers must manually annotate types or use third-party packages like `express-serve-static-core`
- Middleware type composition is fragile and requires significant boilerplate

### OpenAPI Generation Support

Hono's OpenAPI story is clean and opinionated via `@hono/zod-openapi`.

**Hono + Zod OpenAPI:**
- Single package that integrates Zod schemas with OpenAPI spec generation
- Automatically derives OpenAPI paths from route definitions
- Generates valid OpenAPI 3.1 specifications without manual YAML maintenance
- Validation errors produce consistent OpenAPI-compliant responses
- The package is maintained by the Hono core team, ensuring compatibility

**Fastify's OpenAPI:**
- Uses `@fastify/swagger` with separate `@fastify/swagger-ui` for documentation
- Schema definitions use JSON Schema (TypeBox, Ajv, etc.), not Zod
- Requires manual synchronization between route handlers and schema definitions
- More configuration required to achieve equivalent output
- Plugin ecosystem adds complexity and potential version mismatches

**Express's OpenAPI:**
- No first-party OpenAPI support
- Requires third-party solutions like `swagger-jsdoc` with JSDoc annotations
- Annotations are string-based and not validated at compile time
- High risk of divergence between code and generated specs
- Maintenance burden increases with API surface area

### Runtime Dependency Footprint

Hono has minimal runtime dependencies, which is critical for self-hosted deployments and edge-compatible architectures.

**Hono:**
- Zero runtime dependencies in core package
- Tree-shakeable—only imported middleware is included in bundle
- Works on any JavaScript runtime: Node.js, Bun, Deno, Cloudflare Workers, Vercel Edge
- Bundle size: ~13KB minified+gzipped for core
- No transitive dependencies to audit or update

**Fastify:**
- Requires Node.js exclusively (no edge runtime support)
- Core dependencies include `avvio` (plugin framework), `fast-json-stringify`, `find-my-way`
- Additional packages needed for common functionality (CORS, logging, validation)
- Bundle size: ~40KB+ minified+gzipped with essential plugins
- ESM/CJS dual-package complexity in some versions

**Express:**
- Many transitive dependencies (`body-parser`, `cookie`, `debug`, `finalhandler`, etc.)
- Node.js only
- Bundle size: ~200KB+ for full dependency tree
- Security vulnerabilities in transitive deps require regular auditing
- Legacy codebase with slower update cadence

### License Compatibility

All three frameworks satisfy the dual MIT/Apache-2.0 requirement, but Hono's cleaner license posture reduces legal review overhead.

**Hono:** MIT License - permissive, no copyleft concerns, compatible with both MIT and Apache-2.0 projects.

**Fastify:** MIT License - same compatibility.

**Express:** MIT License - same compatibility.

*Note: License is a non-differentiator here, but Hono's minimal dependency tree means fewer transitive license audits.*

### Ecosystem Maturity

This is where Fastify and Express have advantages, but Hono's trajectory addresses the concerns for v1's use case.

**Express:**
- Pros: 10+ years of production use, massive plugin ecosystem, extensive documentation, ubiquitous in Node.js communities
- Cons: Stagnant development (v4 released 2014), security incidents in transitive dependencies, architectural decisions predate modern TypeScript

**Fastify:**
- Pros: Strong performance benchmarks, active core team, growing ecosystem, v4 released 2022 with breaking changes showing evolution
- Cons: Smaller plugin library than Express, steeper learning curve, less community content for common patterns

**Hono:**
- Pros: Rapid adoption (2021+), maintained by a single dedicated core contributor (Yusuke Wada), strong TypeScript-first design, multi-runtime support future-proofs against runtime shifts
- Cons: Smaller ecosystem than Express/Fastify, fewer third-party middleware options, less production war stories at enterprise scale

*Assessment for v1:* Hono's ecosystem gaps are not blockers for a new application. The core functionality (routing, middleware, OpenAPI) is complete and well-tested. The multi-runtime support is a strategic advantage that Express/Fastify cannot match. For a greenfield TypeScript project, Hono's tradeoffs favor long-term maintainability over short-term plugin availability.

### Self-Host Friendliness

Hono excels in self-hosted scenarios due to its runtime-agnostic design.

**Hono:**
- Can be deployed anywhere: Node.js, Bun, Deno, or serverless/edge platforms
- No runtime-specific dependencies (e.g., Fastify's Node.js event loop assumptions)
- Easy to containerize with minimal base images (Deno/Bun images under 50MB)
- Cold start times are competitive due to small bundle size
- Works behind reverse proxies without special configuration

**Fastify:**
- Node.js-only limits deployment options
- Requires more careful tuning for high-concurrency self-hosted scenarios
- Plugin ecosystem assumes Node.js environment (some plugins don't work in alternative runtimes)

**Express:**
- Node.js-only
- Legacy middleware often makes assumptions about Node.js internals
- Larger dependency tree increases attack surface and maintenance burden

## Criteria Comparison Table

| Criteria | Hono | Fastify | Express |
|----------|------|---------|---------|
| **TypeScript Inference** | Excellent (built-in) | Good (requires plugins) | Poor (manual annotations) |
| **OpenAPI Support** | Excellent (`@hono/zod-openapi`) | Good (`@fastify/swagger`) | Poor (third-party only) |
| **Runtime Footprint** | ~13KB, zero deps | ~40KB+, multiple deps | ~200KB+, many transitive deps |
| **Runtime Support** | Node/Bun/Deno/Edge | Node.js only | Node.js only |
| **License** | MIT | MIT | MIT |
| **Ecosystem Maturity** | Growing (2021+) | Mature (2018+) | Very Mature (2010+) |
| **Self-Host Friendliness** | Excellent | Good | Fair |
| **Type-Safe Middleware** | Yes (inferred) | Yes (schema-based) | No (manual) |
| **Bundle Size (with essentials)** | ~25KB | ~70KB | ~250KB |

## Rejected Alternatives

### Fastify

Fastify was rejected despite its strong performance and active development. Its schema-first type inference requires JSON Schema definitions before gaining TypeScript benefits, creating friction in a TypeScript-native workflow. The Node.js-only runtime limits deployment flexibility—a meaningful constraint for self-hosted scenarios where edge runtimes or Bun may offer operational advantages. OpenAPI generation works but requires `@fastify/swagger` plus manual schema synchronization, whereas Hono's `@hono/zod-openapi` provides an opinionated, integrated path. For v1's requirements (TypeScript-first, OpenAPI by default, multi-runtime readiness), Hono's tradeoffs are superior.

### Express

Express was rejected primarily due to its TypeScript story. Designed for JavaScript in 2010, its type support is retrofitted via community `@types` packages rather than built-in. Request parameter inference, body typing, and middleware composition all require manual annotations or third-party packages that lack formal guarantees. OpenAPI generation is an afterthought requiring JSDoc-based tools that are unvalidated at compile time. The large transitive dependency tree increases security audit burden. While Express has unmatched ecosystem maturity, that maturity is rooted in a pre-TypeScript era—its strengths don't align with v1's priorities. For a new TypeScript application, Express introduces avoidable friction.

## Consequences

**Positive:**
- Consistent TypeScript type inference across all route handlers
- OpenAPI specs generated from code, not manual YAML
- Deployment flexibility (can target edge runtimes if needed)
- Smaller bundle sizes and faster cold starts
- Reduced security audit surface from minimal dependencies

**Negative:**
- Smaller third-party middleware ecosystem means more custom implementations
- Less community content/tutorials compared to Express/Fastify
- Fewer production case studies at enterprise scale
- Single core maintainer (bus factor concern, though engagement is high)

**Neutral:**
- License is MIT (same as alternatives)
- Learning curve is moderate for developers familiar with middleware patterns

## References

- Hono documentation: https://hono.dev
- @hono/zod-openapi: https://github.com/honojs/middleware/tree/main/packages/zod-openapi
- Fastify documentation: https://fastify.io
- Express documentation: https://expressjs.com
- SPEC.md handoff format: https://github.com/MultiAgency/kanban/blob/main/SPEC.md#handoff-comment-format
