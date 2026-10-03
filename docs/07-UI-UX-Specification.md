# 07 — Web UI/UX Specification

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Navigation and presentation

Desktop sidebar with Dashboard, Tasks, Today, Planner, Timeline, Analytics and Settings. Use a compact navigation pattern on narrow screens. Support keyboard navigation, visible focus, semantic controls, screen readers, sufficient contrast and reduced-motion preferences. No status may rely on color alone.

## Screen contract

| Screen | Required contents |
| --- | --- |
| Dashboard | Active task/type, session elapsed and Pause/Done; next block; today planned/actual and task breakdown. |
| Tasks | Create/edit/list, type/notes/optional progress, confirmation options, Start/Resume/Complete/Archive; completed/archived filters. |
| Today | Flat dated todos with completion, optional linked task, notes, progress, estimate and deadline. |
| Planner | Day selection, task and break blocks, current-time marker, create/edit/delete; explicit boundary/overrun choices. |
| Timeline | Actual sessions and clearly distinct plans; unknown gaps; detail, manual add/edit/delete/reassign with validation. |
| Analytics | Daily/weekly/monthly selection, totals/task breakdown/session statistics/trends/planned-vs-actual. |
| Settings | Task defaults, general/date display, local data/privacy, export/reset and runtime limitations. |

Use browser UI conventions rather than macOS menus/keyboard shortcuts. No keyboard/mouse monitoring toggles, allowed-app editor or OS permissions panel in MVP. Reading/Passive affects suggested confirmation policy, not detection confidence.

## Prompt and recovery UX

One actionable in-app prompt at a time; include task/context and reason. A periodic prompt explicitly asks whether work continued; clicking elsewhere does not count as Yes. Planner choices do not override unresolved tracking uncertainty. Stale actions are ignored and reconcile current state.

Recovery displays start, last confirmed time and checkpoint separately, with End, Edit end time and confirmed Discard. Explain that the browser was interrupted and the interval is uncertain; do not label it confirmed sleep or inactivity.

## Honest runtime and storage communication

Explain: manual tracking may continue while other apps are used; a hidden page is not stopped work; reminders may be delayed when the browser suspends the app; closed-tab reminders are unavailable. Show a follower-tab state when another tab owns tracking and provide safe reconciliation rather than duplicate controls.

Local data is stored in this browser/profile for this site. Explain site-data deletion risk and encourage explicit export. Show offline readiness only after cache setup succeeds; distinguish network/offline status from storage failure. A quota/permission/migration error must not be shown as a successful save.

## States and destructive actions

Each feature supplies empty, loading, invalid-input and persistence-error states. Task removal defaults to archive. Confirm permanent task/session deletion and full reset with the actual affected scope. Export is user initiated. No unavailable controls presented as implemented functionality.

## UI acceptance

Complete one workflow at a time. Verify responsive layout, keyboard/screen-reader use, consistent committed tracking state, understandable recovery, accurate planned/actual distinction, explicit choices and absence of native-only capability claims. Full navigation polish follows the underlying features.
