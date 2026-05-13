# ADR # REST over GraphQL rationale

**Status:** Accepted
**Context:** v1 of the product needs an API contract for client‑server communication. Two primary options were considered: a traditional REST + OpenAPI approach or a GraphQL API. The team must choose an approach that aligns with the existing ecosystem, developer experience, and operational constraints.

**Decision:** Adopt **REST + OpenAPI** as the primary API surface for v1.

**Rationale:**

| Consideration | REST + OpenAPI | GraphQL |
|---------------|----------------|---------|
| **Developer familiarity** | Most developers on the team (and downstream contributors) are already comfortable with REST endpoints, curl, and OpenAPI generators. | GraphQL requires learning a query language, schema design, and new tooling (Apollo, GraphQL Codegen). |
| **Tooling & ecosystem** | Mature tooling (Swagger UI, OpenAPI generators, Postman) provides instant documentation, client SDK generation, and easy testing. | GraphQL tooling is improving but still fragmented; client generation often ties to specific runtimes. |
| **Operational simplicity** | Simple HTTP verbs, clear status codes, easy caching and CDN support. | Requires a GraphQL server layer, resolver plumbing, and careful handling of N+1 queries. |
| **Self‑host friendliness** | No additional runtime (e.g., GraphQL server) needed; fits the lightweight deployment model for early adopters. | Adds runtime complexity and potential performance overhead for small services. |
| **Debugging & observability** | Straightforward request/response logs, easy to reproduce with curl. | Queries can be opaque; debugging requires introspection queries or GraphQL IDEs. |
| **Community & support** | Broad community support, many examples for typical CRUD patterns. | Growing but still niche for some backend stacks. |

**Rejected alternatives:**

* **Full GraphQL implementation** – rejected due to added operational complexity, higher learning curve, and limited immediate benefit for the core use‑cases of v1.
* **Hybrid approach (REST + GraphQL)** – considered for future v2 but deemed premature; would introduce unnecessary duplication of effort now.

**Consequences:**

* The API will be described in an OpenAPI 3.1 document stored at `docs/openapi/v1.yaml`.
* Client SDKs can be generated automatically for TypeScript, Go, and Python.
* Future migration to GraphQL (if needed) can be performed as a separate integration layer without disrupting the existing REST contract.

**References:**

* OpenAPI Specification – https://swagger.io/specification/
* GraphQL Foundation – https://graphql.org/
