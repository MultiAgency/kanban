# ADR 0004 – Multi‑tenancy Deferred Rationale

## Status
Accepted

## Context
v1 ships single‑tenant by default. Multi‑tenant support is optional via `MULTI_TENANT=true` flag. Need to consider engineering cost, why not needed now, architecture, trigger conditions.

## Decision
Implement multi‑tenant as a flag (`MULTI_TENANT=true`). Default remains single‑tenant. The flag enables multi‑tenant mode, affecting auth isolation, billing, data export, etc.

## Rationale
- **Engineering cost:** auth isolation, per‑tenant billing, data export, support burden, noisy‑neighbor handling, per‑tenant migrations.
- **Why v1 doesn't need it:** validation stage; single‑tenant is sufficient for bootstrap validation.
- **Deferred architecture:** `tenant_id` reserved on every table from day one (#6's surface); schema migrations are pure backfills when the flag flips on; auth and isolation work concentrate at flag‑flip time, not v1 ship time.
- **Trigger conditions:** real demand from a multi‑tenant deployer paying for the feature, hosted‑instance launch, or strategic partnership.

## Comparison Table
| Aspect | Single‑tenant (default) | Multi‑tenant (flag) |
|--------|------------------------|---------------------|
| Auth isolation | Simple per‑project auth | Per‑tenant isolation |
| Billing | N/A | Per‑tenant billing |
| Data export | Simple DB dump | Export per tenant |
| Scaling | Suitable for bootstrap | Supports multiple tenants |
| Complexity | Low | Higher (additional layers) |

## Rejected Alternatives
- Making multi‑tenant default: would increase complexity for early adopters.
- Separate deployment per tenant: not needed for v1 scope.

## Consequences
- Adds code paths for flag handling.
- Requires testing of auth isolation and billing logic.
- Future work: UI for tenant management, admin console.

## References
- SPEC.md Objective: convention persists indefinitely.
- #6 schema surface for `tenant_id`.
- #8 mode enum discussion.
