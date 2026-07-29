# Functional Completeness & Requirements Coverage Audit — Doctor App (وريد / سند)

> **Generated:** 2026-07-26 · **Companion to** `FRONTEND_IMPLEMENTATION_PLAN.md` (which covers code quality / re-renders / leaks / perf).
> **This document answers:** does the app actually *do* what the client requirements ask — CRUD, search, filters, pagination, loading states, error states, success/error toasts — screen by screen.

---

## 1. The one-sentence verdict

**The app looks ~90% built and is ~20% functionally wired.** It is a high-fidelity visual shell: **reads are mostly connected** (dashboard home, ops KPIs, admin lists all pull real Prisma data), but **writes/actions are almost entirely not wired** — even though the backend already exposes the endpoints for them. Of ~40 mutation endpoints that exist in `src/app/api/`, the frontend calls exactly **5**.

| Area | Visual completeness | Reads wired | Actions/CRUD wired | Net functional |
|---|---|---|---|---|
| **Patient** | ~95% | demo data only (no network at all) | 0 booking flows persist | **~15%** |
| **Role dashboard — home** | ~95% | KPIs/tasks/activity/calendar ✅ live | earnings=mock, alerts=partial | **~70%** |
| **Role dashboard — sub-pages** | ~95% | ❌ call **non-existent** endpoints (404) | 0 status actions wired | **~5%** |
| **Operations** | ~90% | KPIs + all lists ✅ live | only accept/reject/hold | **~15%** |
| **Admin** | ~90% | most lists ✅ live | only partner-status PATCH | **~10%** |

---

## 2. Infrastructure gaps (app-wide, block everything else)

These are missing *systems*, not per-page bugs. Every screen inherits them.

| System | Status | Evidence | Impact |
|---|---|---|---|
| **Toast / notifications** | ❌ **Does not exist** | no `sonner`, `useToast`, or `<Toaster>` anywhere | No success/error feedback on any action, anywhere. Users can't tell if anything worked. |
| **Route loading UI** | ❌ **Zero `loading.tsx`** | `find src/app -name loading.tsx` = 0 | No route-level Suspense fallback; only some components show inline skeletons. |
| **Route error boundaries** | ❌ **Zero `error.tsx`** | 0 files; also no `global-error.tsx` / `not-found.tsx` | Any thrown error crashes to the raw Next error screen; failed fetches render as silent empty states. |
| **Error rendering in pages** | ❌ Near-universal | pages destructure only `{ data, isLoading }` from `useDashboardData`, ignoring `error` | The hook *returns* `error`, but almost no page shows it. 404s look like "no data". |
| **Pagination** | ⚠️ **2 pages only** | `<Pagination>` used in `doctors/page.tsx`, `teleconsultation/page.tsx` (over ~35 demo doctors) | Every admin/ops/dashboard list renders the full array unbounded — no pagination at all. |
| **Mutation wiring** | ⚠️ **5 of ~40 endpoints** | the only client mutations: `orders/page.tsx:53`, `admin/partners/[id]:75`, `use-notifications:24`, `login:29`, `ultramessages.ts:23` | The entire management surface (create/edit/delete/assign/advance-status) is inert. |
| **Shared API/mutation client** | ❌ None | each page hand-rolls `fetch` in `useEffect`; no `useMutation` pattern | No consistent place to add loading/error/toast on writes. |

**Consequence:** you cannot meaningfully wire CRUD until a minimal foundation exists — a toast provider, `error.tsx`/`loading.tsx`, and a `useMutation`-style helper. That's **Phase F0** below.

---

## 3. Requirements coverage — screen by screen

Legend: ✅ built & wired · ⚠️ UI-only / mock / partial · ❌ missing

### 3a. Role Dashboard — the required 8 fixed sections (`dashboard/page.tsx`)

| # | Required section | Status | Note |
|---|---|---|---|
| 1 | Header (logo, entity, user, global search, notifications, dark toggle) | ⚠️ | Renders, but **search is a dead input**, **notification badge hard-zero**, **logout has no handler**. Dark toggle + profile work. |
| 2 | Today's Summary — 4 KPI cards (per role) | ✅ | Live from `/api/dashboard/summary`; KPIs switch correctly per role. |
| 3 | Current Tasks (biggest area, role-specific rows, one table design) | ✅ | Live from `/api/dashboard/tasks`; columns switch per role via `lib/task-columns.ts`. |
| 4 | Alerts (5 types) | ⚠️ | Only **2 of 5** types produced; `alerts/route.ts` queries appointments then **discards** them. |
| 5 | Recent Activity | ✅ | Live from `/api/dashboard/recent-activity`. |
| 6 | Calendar (today's appointments) | ✅ | Live from `/api/dashboard/calendar`. |
| 7 | Earnings (today / month / upcoming) | ⚠️ | **Mock** — `earnings/route.ts` is a TODO stub returning `{today:0, month:0, upcoming:0}`. Also currency mismatch: route `د.ع` vs KPI cards `ر.ي`. |
| 8 | Quick shortcuts (per role) | ⚠️ | Renders, but links point to routes that **don't exist** (`/dashboard/patients/new`, `/dashboard/trips/start`, …). |

### 3b. Role Dashboard — sub-pages

**All six sub-pages fetch endpoints that do not exist**, so they load permanently empty. The real data lives at differently-named routes they never call.

| Page | Calls (404) | Real endpoint that exists | Status actions |
|---|---|---|---|
| `patients` | `/api/dashboard/patients` | (none — needs building or repoint) | ❌ call/rx/appt buttons dead |
| `prescriptions` | `/api/dashboard/prescriptions` | `/api/prescriptions` + `[id]` PATCH | ❌ dispense/advance not wired |
| `samples` | `/api/dashboard/samples` | `/api/lab-samples` + `[id]` PATCH | ❌ upload-result not wired |
| `imaging` | `/api/dashboard/imaging` | `/api/radiology-requests` + `[id]` PATCH | ❌ upload-report not wired |
| `trips` | `/api/dashboard/trips` | (none) | ❌ start/end-trip dead (no endpoint) |
| `visits` | `/api/dashboard/visits` | (none) | ❌ start/end-visit dead (no endpoint) |

### 3c. Super Admin

| Requirement | Status | File |
|---|---|---|
| Command Center — KPIs | ✅ | `admin/page.tsx` |
| Partner mgmt — **add** (7 types) | ❌ | `partners/page.tsx:68` → links to `/admin/partners/new` which **404s** |
| Partner mgmt — **edit fields** | ⚠️ | `partners/[id]` fields are read-only divs (`Save`/`Trash2` imported, unused) |
| Partner mgmt — suspend/activate/pause | ✅ | `partners/[id]:74` PATCH — **the only wired admin mutation** |
| Partner mgmt — **delete** | ❌ | DELETE endpoint exists, no UI |
| Complexes — departments/revenue/stats | ❌ | endpoints exist, zero UI |
| Service mgmt — activate/suspend/pause/hours/governorates/capacity | ⚠️ | `services/page.tsx` — fetched data never rendered; `updateServiceStatus` = `console.log`; controls static |
| Contract mgmt — 8 fields, create/edit | ⚠️ | `contracts/page.tsx` reads **wrong endpoint** (`/api/commissions`); "عقد جديد" dead |
| **Commission Engine — editable % per service** ⭐ | ⚠️ | `commissions/page.tsx` — local `useState` mock; edits never persist (`/api/commissions` PUT unused) |
| Pricing — base/sanad/complex | ⚠️ | static cards, not editable |
| Pricing — discounts/campaigns/coupons | ⚠️ | campaigns/coupons **read** only; no create/edit (PUT/DELETE unused) |
| Wallets — balance/dues/earnings | ✅ | `wallets/page.tsx` read |
| Wallets — transfers/invoices/debts | ⚠️ | "تحويل" button inert; debts hardcoded `٠` |
| System monitoring | ✅ | `monitoring/page.tsx` (10s poll) |
| Reports (9 types) | ⚠️ | orders/satisfaction/top-lists wired; **revenue & profit hardcoded `—`**; top-complexes & sanad missing |
| User mgmt — CRUD + role + enable/disable | ⚠️ | read + role filter ✅; **add/edit/delete/toggle all inert** (endpoints exist) |

### 3d. Operations Dashboard (requirement sections 1–12)

| # | Requirement | Status | Note |
|---|---|---|---|
| 1 | Header (status toggle, new/late counts, global search, notifications, dark) | ❌ | **`ops-header.tsx` is never rendered** — `(operations)/layout.tsx` has sidebar only. Entire section is dead code, off-screen. |
| 2 | Today KPIs (10 metrics) | ✅ | `operations/page.tsx` live (15s poll). |
| 3 | New-order cards + accept/reject/hold/transfer/details | ⚠️ | accept/reject/hold ✅ wired; **transfer dead**; **details link 404s** (`/operations/orders/[id]` route missing); map field omitted. |
| 4 | Dispatch center — 5 lists each with assign button | ❌ | Lists read ✅, but **every assign/send/approve button has no `onClick`**; `/api/orders/[id]/assign` never called. |
| 5 | 11-step execution timeline | ⚠️ | Renders, but display-only; no step-advance; `/timeline` POST unused. |
| 6 | Short medical record (8 fields) | ⚠️ | **Unreachable** — search sets `patientSearch` but nothing sets `selectedPatient`; record never loads; also fires `fetch("")`. |
| 7 | Communications (5 call targets, log, duration, notes) | ⚠️ | log reads ✅; **call buttons dial empty `tel:`**; duration hardcoded "—"; no post-call note (POST unused). |
| 8 | Blood bank (8 fields) | ⚠️ | read-only (7 cols); no accept-donor/status action. |
| 9 | Sanad sessions | ⚠️ | read-only; call button empty `tel:`; no status control. |
| 10 | Lab pipeline (6 stages) | ⚠️ | counters only; no stage-advance (`lab-samples/[id]` PATCH unused). |
| 11 | Radiology (5 steps + send-to-doctor) | ⚠️ | "send to doctor" is a label, not a control. |
| 12 | Pharmacy (5 stages) | ⚠️ | counters only; no stage-advance. |

### 3e. Patient

Visually the most polished area, but **no flow touches the network** — all data is synchronous in-memory demo data, and **every booking fakes success**.

- **Booking flows that fake success (no persistence):** doctor appointment (drawer + inline variant), surgery (hardcoded ref `#SURG-9842`), homecare/nursing, pharmacy cart checkout, taxi (random `#TX-####`), blood-bank donate. Backend `appointments`/`sanad-sessions`/`blood-bank`/`orders` POST all exist and are never called.
- **Reschedule & cancel are inert** (`(sanad)/bookings`) — confirming mutates nothing; the app silently lies.
- **6 decorative search inputs** (complexes, pharmacies, labs, offers, surgeries, sanad-home) and several dead filter buttons.
- **`pharmacies` list is a dead end** — cards aren't linked to the working `pharmacies/[id]` commerce page.
- **Best-implemented page (use as template):** `(sanad)/search/page.tsx` — real debounced search + category tabs + `LoadingSkeleton` + `EmptyState`.

---

## 4. Cross-cutting scorecard (the dimensions you asked to scan)

| Dimension | Verdict | Where it's OK | Where it's missing |
|---|---|---|---|
| **Create** | ❌ ~0% | — | no create UI anywhere (partners/users/contracts/commissions/coupons/campaigns/pricing endpoints all exist, unused) |
| **Read** | ✅ ~80% | dashboard home, ops KPIs+lists, admin lists | dashboard sub-pages (wrong URLs), patient (demo only) |
| **Update** | ⚠️ ~5% | partner status, order accept/reject/hold, notification read | everything else (all status/stage/field edits) |
| **Delete** | ❌ 0% | — | no delete UI anywhere (DELETE endpoints exist for partners/users/complexes/commissions/coupons/campaigns/pricing) |
| **Search** | ⚠️ mixed | doctors, doctors-directory, sanad/search, admin users/partners (client-side) | contracts/wallets (bound, not applied), 6 decorative patient inputs, ops medical (dead) |
| **Filter** | ⚠️ mixed | patient specialty/gender/area, dashboard status selects, admin role/type tabs | many dead filter buttons; ops has almost none |
| **Pagination** | ❌ ~4% | doctors, teleconsultation | all admin/ops/dashboard lists (unbounded) |
| **Loading state** | ⚠️ ~40% | dashboard/ops/admin list skeletons (via hook) | dashboard sub-pages ignore `isLoading`; most patient pages |
| **Error state** | ❌ ~2% | — | virtually no page renders the hook's `error`; no `error.tsx` |
| **Empty state** | ⚠️ ~50% | many lists have "لا يوجد…" | dispatch/lab/radiology/sanad render empty `<tbody>`; some dead-branch empties |
| **Success/Error toast** | ❌ 0% | — | no toast system exists |

---

## 5. Master list — backend endpoints with NO working UI trigger

These already exist in `src/app/api/` but nothing in the UI calls them. This is the concrete CRUD backlog.

**Admin / partners:** `POST /partners`, `PATCH /partners/[id]` (fields), `DELETE /partners/[id]`, `PUT /partners/[id]/contract`, `PUT /partners/[id]/services`, `PUT /partners/[id]/schedule`.
**Complexes:** `POST /complexes`, `PATCH`/`DELETE /complexes/[id]`, `POST`/`DELETE /complexes/[id]/departments`.
**Commissions:** `POST /commissions`, `PUT`/`DELETE /commissions/[id]`.
**Coupons:** `POST /coupons`, `PUT`/`DELETE /coupons/[id]`. **Campaigns:** `POST /campaigns`, `PUT`/`DELETE /campaigns/[id]`. **Pricing:** `POST /pricing`, `PUT`/`DELETE /pricing/[id]`.
**Users:** `POST /users`, `PATCH`/`DELETE /users/[id]`. **Wallets:** `POST /wallets/[partnerId]/transfers`.
**Operations:** `POST /orders/[id]/assign`, `POST /orders/[id]/transfer`, `GET`/`POST /orders/[id]/timeline`, `GET`/`PATCH`/`DELETE /orders/[id]`, `PATCH /blood-bank/[id]`, `PATCH /lab-samples/[id]`, `PATCH /radiology-requests/[id]`, `PATCH /prescriptions/[id]`, `PATCH /sanad-sessions/[id]`, `GET`/`PUT /medical-records/[patientId]`, `POST /call-logs`.
**Appointments (dashboard/patient):** `POST /appointments`, `PATCH`/`DELETE /appointments/[id]`.

**Missing endpoints the UI needs (build these):** `/api/dashboard/{patients,trips,visits}` (or repoint the pages), driver start/end-trip, nurse start/end-visit, patient-facing booking submission wiring.

---

## 6. Remediation plan (single-focus steps)

Ordered by dependency. Phase **F0** is foundational and unblocks all wiring. Do code-quality/perf work from the companion `FRONTEND_IMPLEMENTATION_PLAN.md` in parallel or after.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · Effort S/M/L.

### Phase F0 — Foundations (build once, reused everywhere)

- **F0.1 — 🔴 Add a toast system · S.** Install `sonner` (or build a small provider), mount `<Toaster>` in root `layout.tsx`, export a `toast` helper. *Check:* `toast.success()` renders in RTL.
- **F0.2 — 🔴 Add `error.tsx` + `loading.tsx` + `not-found.tsx` · M.** One `error.tsx` per route group (`(patient)`, `(dashboard)`, `(operations)`, `(admin)`) with a retry button; a `loading.tsx` skeleton per group; a root `not-found.tsx`. *Check:* throw in a page → styled error with retry; navigate to a bad id → not-found.
- **F0.3 — 🟠 Add a typed API client + `useMutation` helper · M.** One `apiFetch<T>()` (throws typed errors) and a `useMutation` wrapper that manages `isPending`/`error`, calls the endpoint, fires success/error **toasts (F0.1)**, and returns a refetch trigger. Every CRUD step below uses it. *Check:* a sample mutation shows pending → success toast; forced 500 shows error toast.
- **F0.4 — 🟠 Make `useDashboardData` surface errors + add cancellation · S.** (Also Step 2.1 in the companion plan.) Ensure pages can render `error`; ship a shared `<QueryState loading error empty>` wrapper so lists stop swallowing failures. *Check:* kill an endpoint → the list shows an error with retry, not a blank.

### Phase F1 — Fix the silently-broken reads (highest deception risk)

- **F1.1 — 🔴 Repoint the 6 dashboard sub-pages to real endpoints · M.** `prescriptions`→`/api/prescriptions`, `samples`→`/api/lab-samples`, `imaging`→`/api/radiology-requests`; build or repoint `patients`, `trips`, `visits`. *Check:* each sub-page shows real rows, not empty.
- **F1.2 — 🟠 Fix Alerts to emit all 5 types · S.** `alerts/route.ts` — stop discarding `upcomingAppointments`; map incomplete-rx + urgent. *Check:* all 5 alert kinds can appear.
- **F1.3 — 🟠 Implement the Earnings endpoint · M.** Replace the `earnings/route.ts` TODO stub with real today/month/upcoming aggregates; fix the `ر.ي`/`د.ع` currency mismatch app-wide. *Check:* earnings widget shows real figures in one currency.
- **F1.4 — 🟠 Render `ops-header` (Requirement Section 1) · S.** Mount `OpsHeader` in `(operations)/layout.tsx`; wire new/late counts, global search, notifications, persist status toggle. *Check:* header appears on every ops screen and its controls work.
- **F1.5 — 🟡 Fix admin data-source mistakes · S.** `contracts` → contract endpoints (not `/api/commissions`); `services` → render fetched data (not the hardcoded example); reports revenue/profit real; wallet debts real. *Check:* these pages reflect API data.

### Phase F2 — Wire the core action loops (CRUD)

Each step = wire one action set through the F0.3 mutation helper (pending state + success/error toast + refetch/optimistic).

- **F2.1 — 🔴 Operations: dispatch **assign** · M.** Wire nurse/driver/lab assign buttons → `POST /orders/[id]/assign`. *Check:* assigning moves the order and toasts.
- **F2.2 — 🟠 Operations: order **transfer** + **details** route · M.** Wire transfer → `/transfer`; create `/operations/orders/[id]` detail page. *Check:* transfer works; details opens a real page.
- **F2.3 — 🟠 Operations: advance pipelines · M.** Wire stage-advance for lab (`/lab-samples/[id]`), pharmacy (`/prescriptions/[id]`), radiology (`/radiology-requests/[id]`), blood-bank (`/blood-bank/[id]`), sanad (`/sanad-sessions/[id]`), and the tracking timeline (`/orders/[id]/timeline`). *Check:* each stage button moves the item + toasts.
- **F2.4 — 🟠 Operations: medical record + calls · M.** Make patient selection set `selectedPatient` (load record); wire real `tel:` numbers + post-call note `POST /call-logs`. *Check:* record loads; calls dial; notes save.
- **F2.5 — 🔴 Admin: partner **create/edit/delete** · L.** Build `/admin/partners/new` (create), make detail fields editable (`PATCH`), add delete. *Check:* full partner lifecycle works.
- **F2.6 — 🟠 Admin: Commission Engine persist · M.** Wire the % editor to `POST/PUT /commissions`. *Check:* edits survive reload.
- **F2.7 — 🟠 Admin: services / contracts / pricing / coupons / campaigns CRUD · L.** Add create/edit/delete forms wired to their PUT/POST/DELETE endpoints. *Check:* each entity is manageable end-to-end.
- **F2.8 — 🟠 Admin: user create/edit/delete/toggle · M.** Wire the inert user buttons to `POST/PATCH/DELETE /users`. *Check:* user management works.
- **F2.9 — 🟡 Admin: wallet transfers · S.** Wire "تحويل" → `POST /wallets/[partnerId]/transfers`. *Check:* transfer posts + toasts.
- **F2.10 — 🟠 Dashboard: role status actions · M.** Wire dispense/upload-result/upload-report and (build endpoints for) start/end trip & visit. *Check:* each role can advance its work.
- **F2.11 — 🔴 Patient: real booking submission · L.** Wire doctor/surgery/homecare/taxi/blood-bank/cart flows to their POST endpoints; replace fake success screens with real create + toast; make reschedule/cancel actually mutate. *Check:* a booking persists and appears in `(sanad)/bookings`.

### Phase F3 — Fill the standard-pattern gaps

- **F3.1 — 🟠 Add pagination to every list · M.** Server-side (cursor or page) for admin/ops/dashboard lists; reuse/extend `<Pagination>`. *Check:* large lists page correctly.
- **F3.2 — 🟡 Activate or remove every decorative search/filter · M.** Wire the 6 dead patient search inputs + dead filter buttons + admin contracts/wallets search; remove any that can't be backed. *Check:* no input that looks interactive does nothing.
- **F3.3 — 🟡 Add empty states everywhere · S.** dispatch/lab/radiology/sanad and any empty `<tbody>` get a proper empty component. *Check:* empty lists show a message, not blank.
- **F3.4 — 🟡 Global search · M.** Wire the header search boxes (dashboard + ops) to `/api/search`. *Check:* typing returns cross-entity results.

---

## 7. Suggested milestones

1. **F0 (Foundations)** — toast, error/loading boundaries, mutation helper. One PR; unblocks all wiring.
2. **F1 (Stop lying)** — fix the silently-broken reads (404 sub-pages, mock earnings, partial alerts, hidden ops header, wrong admin sources). Highest trust/value.
3. **F2 (CRUD loops)** — wire actions area by area; start with 🔴 dispatch-assign, partner CRUD, patient booking.
4. **F3 (Patterns)** — pagination, search/filter activation, empty states, global search.
5. Then/parallel: the code-quality, re-render, memory-leak, and perf phases in `FRONTEND_IMPLEMENTATION_PLAN.md`.

---

### Note / correction to the companion report
The first report cited an `Idempotency-Key`/cursor-pagination rule as "required by CLAUDE.md" — that CLAUDE.md belongs to a *different* project (GRAM) loaded in the session, **not** this doctor app, which has no CLAUDE.md and whose own `rules/AUDIT_RULES.md` does not mandate those. Treat idempotency keys and cursor pagination here as *recommendations*, not project rules. Everything else in that report stands.

*Audit only — no source files modified. Each step above is independently committable and verifiable.*
