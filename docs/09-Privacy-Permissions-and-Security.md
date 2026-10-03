# 09 — Web Privacy, Permissions and Security

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Data boundary

Phase 1 business data remains in IndexedDB in the user's browser profile for the app origin. No accounts, backend, work-history telemetry or automatic exports/uploads. Hosting the app distributes code; it does not by itself synchronize browser records. Review any future third-party scripts/analytics before inclusion.

Do not collect typed contents, passwords, raw input history, clipboard, screenshots, URLs/domains, browser history or frontmost application history. No device-monitoring API or broad browser extension permission is needed for MVP.

## Browser storage and exports

Browser data can be cleared, evicted or unavailable in some modes. A persistent-storage request is a best-effort retention improvement, not a backup guarantee. Handle quota, denied access, blocked upgrades and corruption honestly; preserve data and do not silently reset or pretend volatile memory is persisted storage.

JSON/CSV exports require an explicit user action. Explain their scope and private-history contents. Escape CSV and formula-like values; do not include diagnostic logs, ownership tokens or raw activity data. Confirm reset/permanent deletion and invalidate stale state in other tabs.

## Application integrity

Validate names/progress/dates/intervals/relationships outside UI. Transactionally enforce one open session, no overlaps and consistent switch/completion/recovery/deletion. Session/prompt/generation IDs reject stale actions. Multi-tab ownership does not replace database guards. Recovery never fabricates device observations or automatically resumes.

Treat notes/titles as untrusted text: render escaped content; avoid raw HTML injection. Serve production over HTTPS with a restrictive content-security policy suited to the chosen hosting/runtime. Do not embed secrets in frontend code. Dependency versions/security updates are reviewed at implementation; no remote runtime dependencies for core tracking.

## Permissions and offline updates

MVP requires no notification, accessibility, input-monitoring, screen-recording or device-idle permission. Browser system notifications, push and Idle Detection are deferred. If added later, request contextually and preserve manual functionality when denied.

A service worker caches app assets only. Version caches and coordinate update activation so an update does not interrupt active-session ownership or discard records. Do not claim service workers guarantee background monitoring.

## Logging and validation

Use local, minimal diagnostic metadata. Avoid task/todo contents and unnecessary business history in logs. Test cross-tab races, failed commits, stale actions, recovery, migration fixtures, XSS-safe rendering, export handling, offline updates and explicit destructive flows before release.

## Future review triggers

Accounts/sync/cloud processing, remote analytics, native companion, browser extension, app/URL observation, push and automated backups require a fresh privacy/security design. Archived macOS entitlements and permission flows do not apply to the web MVP.
