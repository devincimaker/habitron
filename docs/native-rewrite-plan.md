# Thrive Native Rewrite Plan

**Date:** 2026-08-20
**Decision:** Thrive pivots from a multi-user Expo/React Native + Supabase product to a **single-user, fully native iOS app** — a personal life coach for one person. Data lives on-device (SwiftData, local-first); the only server is a thin, stateless coach service that fronts the LLM. Widgets and Live Activities are first-class from the start.

This plan is grounded in a full audit of the current codebase (schema, coach pipeline, and every mobile screen) performed on 2026-08-20.

---

## 1. Why this works

Three facts from the audit make the rewrite cheap relative to what it buys:

1. **The Expo dependency surface is thin.** The app uses haptics, notifications, audio recording, SVG, and gradients — all trivial in native iOS. There are no deep RN-native modules to lose.
2. **Most of the backend exists only because the app was multi-user.** Auth, RLS, `user_id` on every table, push-token/timezone gymnastics, three Supabase edge functions + pg_cron for notifications — all of it collapses when identity is "the device."
3. **The soul of the app is portable.** The domain schema maps ~1:1 to SwiftData. The coach logic (system prompt, proposal JSON schema, 5-stage validation pipeline, memory extraction) is provider-side text and pure logic — it ports to a thin server nearly verbatim. Proposal *application* is already client-side (`applyCoachProposal.ts`) and becomes a SwiftData transaction.

## 2. What gets cut (the pivot dividend)

| Cut | Replaced by |
|---|---|
| Supabase auth, login/signup screens, JWT middleware | Nothing. Identity is the device; server uses a static bearer token. |
| `user_id` columns, RLS policies, `user_profiles`, `push_tokens`, `user_notification_flags` | Local settings (name, reminder toggle) in `UserDefaults`/SwiftData. |
| **Goals** (store, service, `GoalEditorModal`, coach actions, `todos.goal_id`) | Removed entirely — the v1 planning doc already descoped them; no screen ever listed them. |
| 3 edge functions + pg_cron + `scheduled_notifications` + Expo Push API | Local `UNUserNotificationCenter` scheduling. All timezone hackery disappears. |
| `/api/transcribe` + whisper-1 + multer upload | On-device `SFSpeechRecognizer` (or `SpeechAnalyzer` on iOS 26). |
| `apps/web` (one-page landing) | Nothing. |
| `coaching_session_debug_events` table + endpoints | Local ring buffer via `os_log` / a debug log file. |
| Dead code: `HabitDetailsModal` (467 lines, unreferenced), `MonthlyCalendar`, `DailyPlanCard`, duplicate `profile.tsx`, `diary.tsx` alias, duplicate `sessions.tsx` tab, `SuggestionCard`, Sentry test-crash row, 3 disabled quick-action buttons | Habit stats get **rebuilt as a real feature** (see §5); the rest dies. |
| `journal_entries.energy` / `stress` (dead columns, never in UI or types) | Not migrated. |

## 3. Target architecture

```
thrive/
├── ios/                    # New Xcode project (SwiftUI)
│   ├── Thrive/             # Main app
│   ├── ThriveWidgets/      # WidgetKit extension (widgets + Live Activities)
│   └── ThriveShared/       # SwiftData models, repositories, AppIntents — shared framework
├── server/                 # Thin coach service (trimmed from apps/api)
└── docs/
```

- **UI:** SwiftUI, `@Observable` view models, no heavy architecture framework.
- **Minimum target: iOS 18.** Personal app on your own phone; gives SwiftData maturity, interactive widgets, widget tinting, modern App Intents.
- **Persistence:** SwiftData, with the store in an **App Group container** (`group.com.devinci.thrive`) so the widget extension reads and writes the same database. This is the load-bearing decision for the widget priority — it must be in place from day one.
- **Widgets/app write coordination:** after any mutation, call `WidgetCenter.shared.reloadTimelines`. App Intents in the widget extension write directly to the shared store.
- **Voice:** on-device speech recognition; keep the current recorder UX (metering waveform, 4-min cap, stop-and-edit vs. send).
- **Crash reporting:** optional `sentry-cocoa`, or skip it — it's a personal app.

## 4. SwiftData model (mapped from the final Supabase schema)

`packages/shared/src/types/index.ts` is the reference. All `user_id`/RLS scaffolding drops.

- **`Habit`** — `name`, `frequency` (`.daily`/`.weekly`), `weeklyDays: [Weekday]?`, `weeklyCount: Int?`, `timeOfDay` (`.anytime/.morning/.afternoon/.evening`), `reason: String?`, `icon`, `active`, `createdAt`. **New: `trigger: String?`** — the cue field from `tasks.md` (net-new; no partial implementation exists).
- **`HabitLog`** — `date` (day precision), `status` (`.completed`/`.skipped`; *pending = no row*, matching current semantics), unique per habit+day.
- **`Todo`** — `title`, `notes?`, `status` (`.open/.completed/.canceled`), `priority (1–4)?`, `dueDate?`, `scheduledDate?`, `scheduledTime?` (HH:MM), `estimateMinutes?`, `completedAt?`, `canceledAt?`, `sortOrder`. Relationships: `list` (required), `tags` (many-to-many — the join table becomes a native relationship). **No goal reference.**
- **`TodoList`** — `name`, `color?`, `isInbox`, `sortOrder`. Keep the auto-created Inbox.
- **`TodoTag`** — `name` (unique case-insensitive), `color?`.
- **`JournalEntry`** — `entryDate`, `content`, `mood?` (5 values), `source` (`.manual`/`.coach`). **One concept, named Journal** (diary was only ever a legacy alias for the same table).
- **`DailyPlan`** — `planDate`, `version`, `status` (`.draft/.accepted/.superseded/.discarded`), `source`, `parentPlan?`, `rationale?`, `acceptedAt?`. Keep the one-accepted-plan-per-day invariant and the supersede-on-accept versioning flow from `services/dailyPlans.ts`.
- **`DailyPlanItem`** — `itemType` (`.habit/.todo/.note`), optional `habit`/`todo` refs, **snapshotted** `titleSnapshot`/`notesSnapshot`/`estimateMinutesSnapshot`, `scheduledTime`, `isOptional`, `position`, `outcome` (7 values), `resolvedAt?`. Keep the tagged-union invariant.
- **`Memory`** — `content`, `category` (6 values), `session?`. **Add now (cheap, from the v1 doc): `sourceType` (`.chat`/`.behavior`) and `confidence: Double?`** so behavior-derived lessons land in the same system later.
- **`CoachSession`** — `name?`, `messages: [ChatMessage]` (Codable), `startedAt`, `endedAt?`, `isProcessed`. Keep lazy creation (no session row until the first real user message) and the 10-minute recovery window.

### Bugs to fix in the port (not copy)

1. **Streak calculation must respect scheduling.** Today's `calculateStreak` ignores `weeklyDays`/`weeklyCount` — a Mon/Wed/Fri habit's streak breaks every Tuesday. The Swift version walks only *due* days (and treats weekly-count habits week-by-week).
2. **The coach's journal action is a lie.** The system prompt advertises "Journal capture: create" but `CoachAction` has no journal case — implement `journal.create` for real (entry with `source: .coach`).
3. **Habit stats resurface.** The dead `HabitDetailsModal` (month calendar, streak, monthly rate, tap-a-day-to-edit) becomes a real habit detail screen — it also feeds the widgets.
4. **The notification deep-link mismatch** (`autoStart` vs `autoPrompt`) dies with the old codebase; native notifications route directly to a "start session with prompt" intent.

## 5. Widgets & Live Activities (the priority)

Built in Phase 2, immediately after the core models exist, because they validate the App Group architecture early.

**Widgets (WidgetKit + App Intents):**
1. **Habits Today** (small + medium) — interactive check-off buttons via `AppIntent`; completing a habit from the home screen never opens the app. Shows remaining count and completion ring.
2. **Lock-screen accessories** — circular: today's completion ring; rectangular: next due habit or next plan item with its time; inline: streak.
3. **Today's Plan** (medium/large) — the daily plan finally gets a surface (today it renders *nowhere* except inside the coach proposal card). Next scheduled item highlighted; tap deep-links to it.
4. **Journal quick capture** (small) — deep-links into the voice composer (the `?compose=1&voice=1` path that exists today but is never invoked).

**Live Activity — "Today":** starts when you accept a daily plan (or first check-off of the morning), lives on the lock screen / Dynamic Island all day: habits done x/y, current/next plan item, quick check-off intent. Ends at day close with a summary state.

**Free wins once App Intents exist:** Siri/Shortcuts phrases — "Log <habit>", "Add task", "Journal this" — and Shortcuts automations (e.g., journal prompt when arriving home). No extra architecture needed.

## 6. The thin coach server

A stateless HTTP service — **no database at all**. The device owns all state and sends a planning packet per turn; the server's only job is prompt assembly, the LLM call, and response validation. One secret: `OPENAI_API_KEY`. Auth: static bearer token. Deploy: Fly/Render micro instance, or just the Mac.

**Routes:**
- `POST /chat` — port of today's chat: system prompt (`openai.ts:264–374`), context rendering with `[id: uuid]` entity references, structured-output JSON schema, and the full 5-stage validation pipeline (strip nulls → action whitelist → entity-ids-exist → no-duplicate-actions → proposal-matches-message). This pipeline is real business logic; port it faithfully.
- `POST /extract-memories` — the two-phase extract-then-review flow stays (review UI on device; approved memories saved locally). Port the dedup prompt including the "existing memories" block.
- `POST /name-session` — the 3–7-word title generator.

**Changes from today:**
- **Adopt the "planning packet"** from `docs/v1-coach-planning-implementation-plan.md` instead of ship-everything: open tasks, today's schedule, overdue, active habits, recent completion signal, last 3–7 journal entries, active plan, memories. (At personal scale, sending *all* memories stays fine for a long while; add top-k selection only when it gets slow.)
- **Remove all goal actions** from the `CoachAction` union and the prompt; **add** `journal.create`.
- Keep OpenAI structured outputs initially — the strict JSON schema is already built and battle-tested. The provider lives in one module; swapping later is isolated.
- Proposal application = a single SwiftData transaction on device (port of `applyCoachProposal.ts` including `clientKey → id` resolution), followed by `WidgetCenter` reload.

## 7. Notifications — all local

Everything the server + edge functions + cron do today becomes `UNUserNotificationCenter`:

- **Daily reminder** — calendar trigger at 8 PM; cancelled for the day when a session starts. (Today this takes an edge function, a cron job, a queue table, and a push provider.)
- **First-skip nudge** — scheduled locally at 9 AM next day when a skip is recorded; routes into a coach session about it.
- **New, now trivial:** per-habit reminders from `timeOfDay` and the new `trigger` field; plan-item reminders at their `scheduledTime`.
- **End-of-day auto-skip** (the `check-pending-habits` behavior) becomes a `BGAppRefreshTask` or simply lazy evaluation at next launch — with no server, "unlogged = pending" can just be computed.

## 8. Data migration (one-time)

1. **Export** — a small script (Node, service-role key) dumps your user's rows from every domain table to JSON: habits, habit_logs, todos, todo_lists, todo_tags + assignments, journal_entries, daily_plans + items, memories, coaching_sessions. Skip: goals, debug events, all scaffolding tables, energy/stress columns.
2. **Import** — a debug-only "Import backup" action in the iOS app reads the JSON bundle into SwiftData, preserving `createdAt` timestamps (streak history depends on them) and remapping UUIDs to relationships.
3. **Verify** — row counts per table match; spot-check current streaks against the app (using the *fixed* streak algorithm — expect legitimate differences on scheduled habits and document them).
4. **Retire** — pause the Supabase project and the Render API. Keep the export JSON as the archival backup. The Expo app stays on the phone until Phase 6 completes, then gets deleted.

## 9. UX carried forward vs. rethought

**Keep (it works):** swipe-right complete / swipe-left skip on habits; the 7-day mini calendar; quick-create with inline `#tag` and `HH:MM` parsing; the collapsible week↔month calendar with long-press drag-to-reschedule; journal timeline with mood chips, undo-delete, voice compose; the proposal card accept/dismiss flow; memory review before save; the amber design language (`#F5A623` primary, warm neutrals, rounded cards — port `constants/theme.ts` as a Swift design-token enum). Ship dark mode for real this time (the RN app pinned `userInterfaceStyle: light`, making its dark palette unreachable).

**Rethink for one user:**
- **Coach tab = the chat.** Today the Coach tab is a session-history list and chat is a modal. For a personal coach, the conversation is the front door; history moves behind it. The duplicate sessions tab dies.
- **Plans get a home** on the Tasks/Today screen (per the v1 doc: plans are a thin layer over tasks, "no task exists only inside a daily plan").
- **No onboarding tour, no auth screens, no splash delay.** First launch goes straight to the app.
- Add a tap-to-complete affordance on habit rows (swipe-only is fine in-app but the widget will teach tap habits).

## 10. Build order

Each phase ends with something usable on your phone (personal TestFlight or dev-signed build).

- **Phase 0 — Scaffold.** Xcode project + widget extension + shared framework; App Group; SwiftData models (§4); design tokens ported from `theme.ts`; repo restructure (`ios/`, `server/`).
- **Phase 1 — Habits + Tasks core.** Habit list with swipe gestures + editor + manager; fixed streak engine + habit detail/stats screen; task list + quick-create parsing + editor; calendar with drag-reschedule; local notifications (§7).
- **Phase 2 — Widgets v1.** Habits Today interactive widget, lock-screen accessories, App Intents. *Early on purpose: it's the stated priority and it stress-tests the shared-store architecture while the model layer is still cheap to change.*
- **Phase 3 — Journal.** Timeline, composer, mood filters, on-device voice transcription, journal quick-capture widget.
- **Phase 4 — Coach.** Thin server (§6); session screen with text + voice; proposals + apply transaction; memories + review flow; session naming + history.
- **Phase 5 — Plans surfaced + Live Activity.** Plan layer on the Today view; outcome syncing; the "Today" Live Activity; plan widget.
- **Phase 6 — Migration + retirement.** Export/import (§8); run both apps side-by-side for a few days; retire Supabase/Render/Expo.

## 11. Explicitly deferred

- HealthKit / Screen Time as coach context (not selected now; the planning-packet design leaves an obvious extension point).
- Memory relevance ranking / embeddings.
- `task_day_events` behavioral learning table from the v1 doc (the `Memory.sourceType = .behavior` field keeps the door open).
- Anything multi-user. Ever, until decided otherwise.
