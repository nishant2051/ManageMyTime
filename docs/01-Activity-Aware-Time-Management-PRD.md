# 01 — Web Time Management PRD

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Product and scope

A single-user, local-first web application for planning a day and recording actual work through explicit task/session controls. No account, remote database or synchronization is required for the MVP.

Phase 1 uses React + TypeScript with a Vite build and IndexedDB persistence. This stack is a planning decision; dependency versions will be verified during scaffold implementation. Target desktop Chrome, Safari, Firefox and Edge; verify supported versions in release testing. Responsive small-screen layouts are included, without a separate mobile client.

## Product principles

- User authority: automation offers choices; never infer productivity, progress or task assignment.
- Planned TimeBlocks and actual WorkSessions are independent facts.
- Actual totals derive from discrete sessions. Pause ends a session; Resume creates another.
- At most one active tracked session across tabs of the same browser origin.
- No fabricated duration across uncertain interruptions. Ask the user to resolve ambiguous history.
- No input contents, screenshots, browser history, URLs or application history are collected.

## Functional requirements

| ID | Requirement | Web MVP scope |
| --- | --- | --- |
| FR-1 | Task lifecycle | Create/edit/list/complete/archive; explicit permanent deletion with history consequences. |
| FR-2 | Task types | Active Work, Reading/Passive, Custom; editable per-task confirmation defaults. Types do not imply working device monitoring. |
| FR-3 | Sessions | Start/Pause/Resume/Done, persisted boundaries, live elapsed display and history. |
| FR-4 | Single active task | Explicit switch ends old/starts new atomically; duplicate tabs cannot start a second session. |
| FR-5 | Inactivity | Device-wide keyboard/mouse inactivity deferred. Page inactivity is not evidence that work stopped. |
| FR-6 | Periodic confirmation | Optional in-app confirmation while runtime is available; interruption handling per document 05. No guaranteed background delivery. |
| FR-7 | Intervals | Per-task confirmation interval and grace are configurable; defaults copied on creation. |
| FR-8–9 | App/browser observation | Native app associations and frontmost-app detection deferred; no URL/domain monitoring. |
| FR-10 | Today | Flat daily todos: title, completion, notes, optional progress/estimate/deadline/task link. |
| FR-11–12 | Planner | Task/break blocks, explicit start/switch and overrun choices; no automatic switch or extension of plans. Missed boundaries reconcile on return. |
| FR-13 | Unplanned activity | Automatic device-based classification deferred; user may explicitly start/create a task. |
| FR-14 | Progress | Optional manual percentage, independent of time. |
| FR-15 | Timeline | Planned/actual distinction, session details, understandable untracked gaps; do not label unknown gaps as breaks or idle. |
| FR-16 | Dashboard | Current task/session controls, next block, today planned/actual and task breakdown. |
| FR-17 | Analytics | Daily/weekly/monthly totals, task breakdown, session statistics, trends, planned-vs-actual. |
| FR-18 | Corrections | Add/edit/delete/reassign ended sessions; provenance and overlap validation; derived views update. |
| FR-19 | Sleep/lock | Exact OS events deferred; runtime gaps and uncertain intervals require conservative recovery. |
| Additional | Data/privacy | Local storage explanation, versioned JSON export, session CSV, explicit reset/delete. |

## Acceptance criteria

The MVP is complete when each included requirement works across the supported browser test matrix, records survive reload, duplicate-tab races preserve one open session, storage failures do not appear successful, interrupted sessions require resolution, and exported data matches persisted business records. Manual controls and core workflows work without notification permission. Offline operation after initial app load is included through an app-shell cache; first visit requires serving the app.

No silent automatic resume, task switch, session assignment, progress inference or productivity score is allowed. Hidden-tab state must not be presented as device inactivity.

## Deferred scope

Native monitoring/companion, browser Idle Detection enhancements, system notifications/push, native lifecycle hooks, guaranteed closed-tab prompts, accounts/cloud sync/backend, teams, subtasks, recurring schedules, calendar integrations, browser extensions, AI scheduling, automated backups and import/restore are outside this MVP. Manual JSON export is portability, not a completed restore workflow.

## Delivery

Build one feature at a time following document 06. Web hosting is a later explicit deployment step; revising the docs does not publish a site or replace the existing scaffold.
