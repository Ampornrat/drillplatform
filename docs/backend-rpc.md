# Backend RPC Reference

All Postgres functions called via `supabase.rpc(...)` from server actions.

| RPC | Action File | Input | Returns | Notes |
|-----|-------------|-------|---------|-------|
| `create_incident_from_methane` | incidents.actions.ts | `{ payload: MethanePayload }` | `{ drill_id, methane_report_id }` | Creates drills + methane_reports + event_log row |
| `create_iap_version` | iap.actions.ts | `{ p_drill_id, p_objectives, p_period_start?, p_period_end?, p_notes? }` | `{ id, version }` | Upsert IAP into drills.objectives JSONB |
| `update_iap_section` | iap.actions.ts | `{ p_drill_id, p_section, p_content }` | `boolean` | Partial IAP section update |
| `dispatch_object` | dispatch.actions.ts | `{ p_drill_id, p_object_id, p_site_id?, p_notes? }` | `{ id }` | Creates dispatch_assignment + logs event |
| `upsert_drill_safety_gate` | drill.actions.ts | `{ p_drill_id, p_rule_id, p_status, p_notes? }` | `void` | Insert/update drill_safety_gates |
| `submit_evaluation_score` | evaluation.actions.ts | `{ p_drill_id, p_metric_id, p_score, p_max_score, p_notes? }` | `{ id }` | Inserts into evaluation_scores |
| `generate_aar_findings` | aar.actions.ts | `{ p_drill_id }` | `{ report_id, findings_count }` | Generates aar_reports from event_log |
| `create_improvement_action` | aar.actions.ts | `{ p_aar_report_id, p_description, p_category, p_priority, p_severity }` | `{ id }` | Inserts improvement_actions |
| `close_improvement_action` | aar.actions.ts | `{ p_action_id, p_resolution }` | `boolean` | Marks action completed |
| `propose_sop_update` | aar.actions.ts | `{ p_action_id, p_sop_ref, p_proposed_change }` | `{ id }` | Creates SOP proposal |
| `mark_notification_read` | notification.actions.ts | `{ p_notification_id }` | `boolean` | Updates notifications.is_read |
| `mark_all_notifications_read` | notification.actions.ts | `{ p_drill_id? }` | `integer` | Bulk marks read; returns count |
| `log_platform_event` | iap/dispatch actions | `{ p_source_type, p_source_id, p_event_type, p_payload? }` | `void` | Appends to platform_events |

## Error Pattern

All RPCs return `ServiceResult<T>` via the action wrapper:

```typescript
const { data, error } = await supabase.rpc('rpc_name', params)
if (error) return fail('database_error', error.message)
```

RPC functions that detect business-rule violations return `{ error: string, message: string }` in `data` — checked with `if (rpcData?.error)`.
