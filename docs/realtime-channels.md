# Realtime Channels

All Supabase Realtime subscriptions active in production.

## 1. Notifications channel

**File:** `src/hooks/use-notifications.ts`  
**Channel name:** `notifications:{userId}`  
**Events subscribed:**

| Table | Event | Filter | Handler |
|-------|-------|--------|---------|
| `notifications` | `INSERT` | `user_id=eq.{userId}` | Prepend to list; auto-mark critical as read; toast |
| `notifications` | `UPDATE` | `user_id=eq.{userId}` | Sync read/dismissed state |

**Auto-read rule:** Any notification with `priority = 'critical'` is automatically marked read via `markNotificationReadAction` on receipt.

**Lifecycle:** Created on `useNotifications({ userId, activeIncidentId })` mount; removed on unmount via `supabase.removeChannel(channel)`.

---

## 2. IODP session channel

**File:** `src/lib/iodp/supabase.ts → subscribeToSession()`  
**Channel name:** `iodp-{sessionId}`  
**Events subscribed:**

| Table | Event | Filter | Handler |
|-------|-------|--------|---------|
| `iodp_events` | `INSERT` | `session_id=eq.{sessionId}` | Triggers full data refresh |
| `iodp_patients` | `INSERT \| UPDATE` | `session_id=eq.{sessionId}` | Triggers full data refresh |
| `iodp_teams` | `UPDATE` | `session_id=eq.{sessionId}` | Triggers full data refresh |
| `iodp_safety_gates` | `UPDATE` | `session_id=eq.{sessionId}` | Triggers full data refresh |

**Strategy:** Uses coarse refresh (re-fetches all session data) rather than granular diff — acceptable for drill sizes up to ~200 concurrent events.

**Lifecycle:** Started in `useIodpData` after sessions load; re-subscribed if `mode` changes.

---

## RLS requirements for Realtime

Realtime uses the same RLS policies as REST. Ensure the user's JWT contains the correct role claim and that `profiles.is_active = true`.

Subscriptions silently receive no events if RLS blocks the underlying SELECT — this is expected behaviour for non-privileged users on tables they can't read.

---

## Adding a new channel

```typescript
const channel = supabase
  .channel('my-channel-name')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'my_table',
    filter: `drill_id=eq.${drillId}`,
  }, (payload) => handlePayload(payload.new))
  .subscribe()

return () => supabase.removeChannel(channel)
```
