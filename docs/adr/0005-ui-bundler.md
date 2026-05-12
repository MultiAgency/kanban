# ADR 0005: v1 UI Bundler (rsbuild)

**Status:** Accepted

## Context

v1 requires a UI bundler for development and production builds. The decision has been pre-resolved: **rsbuild** is the chosen bundler. This ADR documents the rationale and rejected alternatives.

### Requirements

- Fast Hot Module Replacement (HMR) for developer productivity
- Production-grade build performance
- Module Federation support (potential future need for runtime composition)
- Alignment with the `nearbuilders/everything-dev` reference architecture
- Self-host friendly (no complex infrastructure requirements)

### Options Considered

1. **rsbuild** (Rspack-based)
2. **Vite** (Rollup-based)
3. **Webpack** (incumbent)

## Decision

**rsbuild** is the chosen UI bundler for v1.

### Rationale

rsbuild provides the best balance of developer experience, build performance, and future-proofing for v1's needs:

- **Rspack foundation**: Built on Rust-based Rspack, offering significantly faster build times than Webpack while maintaining compatibility with the Webpack ecosystem
- **Fast HMR**: Sub-second hot module replacement that scales with project size
- **Module Federation**: Production-grade support if v1 ever needs runtime composition across micro-frontends
- **Reference architecture alignment**: Matches the `nearbuilders/everything-dev` architecture cited at decision time, ensuring consistency across the Near builders ecosystem
- **Self-host friendly**: Simple configuration, no external dependencies beyond Node.js

## Rejected Alternatives

### Vite

Vite is a mature, fast bundler with excellent HMR and a broad ecosystem. However, it uses Rollup for production builds, which lacks the Module Federation capabilities that rsbuild provides through Rspack. For v1's potential future needs around runtime composition and alignment with the Near builders reference architecture, rsbuild's Module Federation support is the differentiating factor. Vite would be an acceptable choice if Module Federation were not a consideration, but rsbuild offers strictly more capability with comparable developer experience.

### Webpack

Webpack is the incumbent solution with decades of maturity and the largest ecosystem. However, it is significantly slower than both rsbuild and Vite in both development and production builds. rsbuild can be viewed as Webpack's spiritual successor—maintaining ecosystem compatibility while delivering Rust-based performance. For a new v1 project where build speed directly impacts developer productivity, there is no compelling reason to choose Webpack over rsbuild unless there were specific legacy plugins or configurations that could not be migrated.

## Criteria Comparison

| Criteria | rsbuild | Vite | Webpack |
|----------|---------|------|---------|
| HMR Speed | ⚡⚡⚡ (Rust) | ⚡⚡⚡ (ESBuild) | ⚡⚡ (JS) |
| Prod Build Speed | ⚡⚡⚡ (Rspack) | ⚡⚡ (Rollup) | ⚡⚡ (JS) |
| Module Federation | ✅ Native | ❌ Limited | ✅ Mature |
| Ecosystem Compatibility | ✅ Webpack-compatible | ⚠️ Plugin ecosystem | ✅ Maximum |
| Configuration Complexity | ✅ Low | ✅ Low | ⚠️ High |
| Reference Alignment | ✅ nearbuilders/everything-dev | ❌ | ❌ |
| Self-host Friendliness | ✅ High | ✅ High | ⚠️ Moderate |

## Why v0's GitHub Action Keeps esbuild

The v0 GitHub Action uses esbuild for a fundamentally different problem: creating a single-file CommonJS bundle targeting Node.js 24 for the Action runtime. This is a byte-stable, deployment-specific constraint where esbuild's speed and minimal output are optimal. v1's UI bundler faces different requirements—HMR, Module Federation, and alignment with the Near builders reference architecture. Unifying v0 and v1 on a single bundler is out of scope; the constraints differ and each tool is the right fit for its respective problem surface.

## Consequences

### Positive

- Fast iteration cycle for UI development team
- Future-proof for potential micro-frontend architecture
- Consistent with Near builders ecosystem reference implementations
- Lower operational complexity for self-hosters

### Negative

- Smaller ecosystem than Webpack (though rspack-compatible plugins work)
- Learning curve for team members unfamiliar with Rspack/rsbuild

### Neutral

- Migration path exists if requirements change (rsbuild → Vite/Webpack)

## References

- [rsbuild documentation](https://rsbuild.dev/)
- [Rspack repository](https://github.com/web-infra-dev/rspack)
- `nearbuilders/everything-dev` reference architecture
- Issue #46: ADR: v1 UI bundler (rsbuild)