# Role Access Matrix

## Profile roles (post migration 008)

| Role | Description | Can Manage Drills | Can Push Injects | Can Evaluate | Can See AAR |
|------|-------------|:-----------------:|:----------------:|:------------:|:-----------:|
| `admin` | Platform administrator | ✅ | ✅ | ✅ | ✅ |
| `commander` | Incident commander | ✅ | ✅ | ✅ | ✅ |
| `controller` | Exercise controller | ✅ | ✅ | ✅ | ✅ |
| `evaluator` | Independent evaluator | ❌ | ❌ | ✅ | ✅ |
| `medical` | Medical officer | ❌ | ❌ | ❌ | read-only |
| `logistics` | Logistics officer | ❌ | ❌ | ❌ | read-only |
| `observer` | Passive observer | ❌ | ❌ | ❌ | read-only |
| `participant` | Field participant | ❌ | ❌ | ❌ | ❌ |
| `guest` | Unauthenticated viewer | ❌ | ❌ | ❌ | ❌ |

## RLS helper functions (migration 016)

| Function | Returns true for |
|----------|-----------------|
| `is_admin()` | admin |
| `is_commander_or_above()` | admin, commander |
| `is_manager()` | admin, commander, controller |
| `is_control_staff()` | admin, commander, controller |
| `user_has_role(VARIADIC text[])` | any of the listed roles |
| `current_user_role()` | text — current user's role |

## Key RLS policies by table

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `drills` | authenticated | commander+ | commander+ | admin |
| `event_log` | authenticated (own org) | non-guest | — | admin |
| `notifications` | own rows only | trigger-only | own rows only | own rows only |
| `sim_clock_state` | control staff | control staff | control staff | control staff |
| `msel_injects` | control staff | control staff | control staff | control staff |
| `inject_deliveries` | control staff | control staff | control staff | — |
| `evaluation_scores` | commander+ | evaluator, controller | evaluator, controller | — |
| `improvement_actions` | commander+ | evaluator, commander | evaluator, commander | admin |
| `facility_status` | authenticated | medical, logistics, commander+ | medical, logistics, commander+ | — |

## IODP workspace roles

The IODP app (`/iodp`) uses a separate role switcher for demo — maps to profile roles:

| IODP display role | Profile role |
|-------------------|--------------|
| Commander | commander |
| Medical | medical |
| Logistics | logistics |
| Controller | controller |
| Evaluator | evaluator |
| Field | participant |
| Admin | admin |
