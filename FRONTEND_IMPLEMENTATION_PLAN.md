# Frontend Implementation Plan — Doctor App (وريد / سند)

> **Generated:** 2026-07-26
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 · Tailwind 3 · Zustand · NextAuth v5
> **Scope audited:** all 55 pages + ~140 components/hooks/stores/lib (`src/`), config, and build health.

## How to use this document

Each **Step** below does exactly **one thing**. Do them top-to-bottom within a phase, commit after each step, and verify with the "Check" line before moving on. Phases are ordered by risk/leverage: infrastructure first (unblocks everything), then correctness bugs (broken features), then leaks, then performance, then the big deduplication refactor, then architecture, then polish.

**Baseline is healthy** — this matters: `tsc --noEmit` passes with **0 errors**, there are **0 `any` types**, `next/font` and per-icon `lucide-react` imports are done right, and there are **no `ignoreBuildErrors`/`eslint.ignoreDuringBuilds`** escape hatches. So this is cleanup-and-harden, not rescue.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · Effort: S (<1h) / M (half day) / L (1–2 days)

---

## Phase 0 — Build & infra health (do first; unblocks the rest)

These are config/tooling fixes. They change no UI but make every later step verifiable.

### Step 0.1 — 🟠 Fix the broken `lint` script · S
- **Problem:** `npm run lint` → `next lint` fails (`Invalid project directory … /doctor app/lint`). `next lint` is removed in Next 16 and the space in the folder path breaks it. CI has **no working lint gate**.
- **Files:** `package.json` (`scripts.lint`), add `eslint.config.mjs` (flat config).
- **Do:** Replace `"lint": "next lint"` with `"lint": "eslint src"`. Migrate `.eslintrc.json` → flat config per the Next 16 ESLint migration.
- **Check:** `npm run lint` runs and reports the 4 known warnings, not a path error.

### Step 0.2 — 🟡 Align `eslint-config-next` to the framework · S
- **Problem:** `eslint-config-next@15.0.0` under `next@16.2.6` — Next 16 lint rules aren't enforced.
- **Files:** `package.json` devDeps.
- **Do:** Bump `eslint-config-next` to `^16`. Consider ESLint 9 (current is EOL `^8`).
- **Check:** `npm run lint` still runs clean after the bump.

### Step 0.3 — 🟠 Match React types to the React 19 runtime · M
- **Problem:** `@types/react`/`@types/react-dom` are `^18` while `react` is `19.0.0`. React 19 changed types materially (ref-as-prop, JSX namespace, `useRef`). Only "passes" because `legacy-peer-deps=true` hides it.
- **Files:** `package.json`.
- **Do:** Bump both `@types/react` and `@types/react-dom` to `^19`. Re-run `tsc --noEmit` and fix anything it surfaces (do this as its own commit so regressions are isolated).
- **Check:** `npx tsc --noEmit` = 0 errors with v19 types.

### Step 0.4 — 🟡 Remove `legacy-peer-deps=true` · S
- **Problem:** `.npmrc` globally silences peer-dependency conflicts, masking 0.3 and others.
- **Files:** `.npmrc`.
- **Do:** After 0.2/0.3, delete the flag, run a clean `npm install`, resolve whatever surfaces.
- **Check:** `npm install` completes with no unresolved peer errors.

### Step 0.5 — 🟡 Drop unused `recharts` dependency · S
- **Problem:** `recharts ^3.9.2` is declared but has **zero imports** in `src/` (verified by grep). Pure bundle/supply-chain cost.
- **Files:** `package.json`.
- **Do:** Remove it. (If charts are planned for the admin/reports dashboards in `client-requirememnt.md`, keep it but note the intended use.)
- **Check:** `grep -rn recharts src/` = empty; `npm run build` still succeeds.

### Step 0.6 — ⚪ Verify `lucide-react@1.14.0` resolves to the genuine package · S
- **Problem:** public `lucide-react` is on the `0.x` line; a `1.14.0` is unusual, and `legacy-peer-deps` masks resolution issues.
- **Do:** `npm ls lucide-react` and confirm registry/source. If it's a typo/mis-resolution, pin to the real latest `0.x`.
- **Check:** icons render and the package resolves to the official source.

### Step 0.7 — 🟡 Fix TS target & add index-access safety · M
- **Problem:** `tsconfig.json` has `"target": "es5"` (legacy transpile bloat on React 19) and no `noUncheckedIndexedAccess` (code does unchecked `Record` lookups like `priorityStyles[order.priority]`, `statusConfig[status]`).
- **Files:** `tsconfig.json`.
- **Do:** Set `"target": "es2017"` (or higher). Add `"noUncheckedIndexedAccess": true`, then fix the lookups it flags (many overlap with the `StatusBadge`/status-map bugs in Phase 1).
- **Check:** `tsc --noEmit` clean after fixes; smaller/modern output.

---

## Phase 1 — Correctness bugs (broken or misleading features)

User-facing things that silently don't work. High value, mostly small.

### Step 1.1 — 🔴 Fix module-constant mutation in commissions editor · M
- **Problem:** `src/app/(admin)/admin/commissions/page.tsx:107-111` does `const newSplits=[...splits]; newSplits[i].parties[j].percentage=…` — shallow-copies the array but mutates the **shared nested objects**, which are the same references as the module-level `exampleSplits`. Edits corrupt the constant and leak across navigations/remounts.
- **Do:** Update immutably (map over splits → map over parties → return new objects). Consider `structuredClone` for the seed.
- **Check:** Edit a percentage, navigate away and back → values reset to defaults, no cross-page bleed.

### Step 1.2 — 🔴 Fix Radiology sidebar routing (dead-end for a whole role) · S
- **Problem:** `src/components/dashboard/dashboard-sidebar.tsx:70-77` — RADIOLOGY links point to `/dashboard/requests` & `/dashboard/reports`, but the real page is `/dashboard/imaging`. Radiology users can't reach their screen. Several other menu links (`/dashboard/appointments`, `/finance`, `/results`, `/inventory`, `/notifications`, `/settings`) also 404.
- **Do:** Point RADIOLOGY to `/dashboard/imaging`; audit every menu href against the actual `page.tsx` files and fix or remove non-existent routes.
- **Check:** Every sidebar link for every role lands on a real page.

### Step 1.3 — 🟠 Make the "medical record" feature functional · M
- **Problem:** `src/app/(operations)/operations/medical/page.tsx:26-32` — `selectedPatient` is never set (the search input only writes `patientSearch`, which is unused), so a record can never load. When null it also calls `useDashboardData({ url: "" })` → `fetch("")` hits the page URL.
- **Do:** Wire search → select → set `selectedPatient`; guard the hook so an empty `url` short-circuits (see Step 2.1).
- **Check:** Searching and selecting a patient loads their record; no `fetch("")` in the Network tab.

### Step 1.4 — 🟠 Wire the dead booking actions in patient bookings · S
- **Problem:** `src/app/(patient)/(sanad)/bookings/page.tsx` — "حجز مرة أخرى" (rebook, `:322`) has no `onClick`; in the cancel dialog (`:482-499`) both confirm and "تراجع" just call `setCancelDialogOpen(false)`, so confirming cancels nothing.
- **Do:** Implement rebook (route to booking flow with prefilled doctor) and real cancel (call the cancel action, then update list/toast).
- **Check:** Rebook navigates correctly; confirming a cancel actually removes/updates the booking.

### Step 1.5 — 🟠 Fix broken click-to-call links · S
- **Problem:** `href="tel:"` with no number in `src/app/(operations)/operations/calls/page.tsx:43` (all five cards) and `.../operations/sanad/page.tsx:83`.
- **Do:** Interpolate the real phone number (`href={`tel:${phone}`}`) or disable the control when absent.
- **Check:** Call buttons open the dialer with a number.

### Step 1.6 — 🟠 Stop losing status colors in dashboard tables · S
- **Problem:** `StatusBadge` (`src/components/shared/status-badge.tsx`) is keyed by raw codes, but pages pass **pre-translated Arabic labels** → lookup misses → every badge falls back to gray. Sites: `dashboard/prescriptions/page.tsx:134`, `samples/page.tsx:126`, `imaging/page.tsx:128`.
- **Do:** Pass the raw status code to `StatusBadge` and let it translate + color internally.
- **Check:** Prescriptions/samples/imaging badges show correct per-status colors.

### Step 1.7 — 🟠 Add default branch to `getStatusConfig` · S
- **Problem:** `src/app/(patient)/(sanad)/bookings/page.tsx:118` — no default; unknown status → `undefined`, then `.bg` deref crashes. (`noUncheckedIndexedAccess` from 0.7 will flag this class of bug repo-wide.)
- **Do:** Return a safe default config for unknown statuses.
- **Check:** Passing an unexpected status renders a neutral badge, no crash.

### Step 1.8 — 🟡 Fix invalid `<button><a>` nesting · S
- **Problem:** `src/app/(dashboard)/dashboard/patients/page.tsx:120-122` nests `<a href="tel:…">` inside `<button>` — invalid HTML → hydration/interaction bugs.
- **Do:** Use a single element (an `<a>` styled as a button, or a `<button>` with an `onClick` dialer).
- **Check:** No hydration warning in console; the control works.

### Step 1.9 — 🟡 Reconcile the doctors-directory data source · S
- **Problem:** `src/app/(patient)/doctors-directory/page.tsx` filters over `allDoctors` (`:46/:190`) but the specialty count badges read `DEMO_DOCTORS[spec.id]?.length` — two sources → counts disagree with results.
- **Do:** Derive counts from the same array the list uses.
- **Check:** Specialty badge counts match the filtered list.

### Step 1.10 — 🟡 Fix table rows keyed by array index under polling · S
- **Problem:** index keys on polled/sortable data cause wrong reconciliation: `operations/dispatch/page.tsx:64,94,123,152,179`; also `admin/pricing/page.tsx:56,78`.
- **Do:** Key by a stable id.
- **Check:** Rows keep identity across refetch/sort (no flicker/state bleed).

### Step 1.11 — 🟡 Remove `console.log` + dead filters in admin services · S
- **Problem:** `src/app/(admin)/admin/services/page.tsx` — `console.log` at `:56` (violates CLAUDE.md), `updateServiceStatus` never called, `search`/`filterStatus` states never applied, fetched `/api/pricing` data never rendered (shows a hardcoded example).
- **Do:** Remove the log; wire the filters and the fetched data, or delete the dead state if the page is intentionally a mock (add a TODO tied to the requirements doc).
- **Check:** No `console.*` in committed code; filters affect the list.

### Step 1.12 — 🟡 Wire (or remove) dead search/filter inputs · S
- **Problem:** search inputs bound but never used to filter: `admin/contracts/page.tsx:43`, `admin/wallets/page.tsx:54`; non-functional search/UI in `services/surgeries`, `services/offers`, `doctors/profile/[id]` ("عرض المزيد"), plus `complexes/[id]/page.tsx` "عرض الكل" links all `href="#"`.
- **Do:** Implement the filtering/links, or remove the controls until backed.
- **Check:** Every visible input/link either does something or is gone.

### Step 1.13 — ⚪ Fix random values computed in render · S
- **Problem:** `services/taxi/page.tsx:327` renders `#TX-${Math.floor(Math.random()*10000)}` in JSX → trip number changes every re-render. Same class: any `Math.random()`/`new Date()` in render.
- **Do:** Compute once in state/`useMemo` (or server-side).
- **Check:** Trip number is stable across re-renders.

---

## Phase 2 — Memory leaks & effect correctness

The repo already has a **correct template** to copy: `src/components/shared/doctor-booking-drawer.tsx` and `src/components/pwa/install-prompt.tsx` track timers in a `timersRef` and clear them on unmount. Mirror that.

### Step 2.1 — 🔴 Add cancellation to `use-dashboard-data` (highest-leverage fix) · M
- **Problem:** `src/hooks/use-dashboard-data.ts:31-53` — the fetch has no `AbortController` and no mounted-guard. It's used by ~25 dashboard/ops/admin/notification/KPI screens. On unmount mid-flight, or rapid param/tab changes, it calls `setData/setError/setIsLoading` after unmount and races (a stale response can overwrite fresh data). Polling ticks have the same race.
- **Do:** In the effect, create an `AbortController`, pass `signal` to `fetch`, `abort()` in cleanup, and ignore `AbortError`. Short-circuit when `url` is empty (fixes the `fetch("")` in Step 1.3). Optionally: pause polling when `document.hidden`.
- **Check:** Rapidly switch tabs/pages under throttled network → no "setState on unmounted" warnings, no stale overwrites.

### Step 2.2 — 🟠 Stop the failing notifications poll in ops header · S
- **Problem:** `src/components/operations/ops-header.tsx:31` calls `useNotifications(null)` → `use-notifications.ts` polls `/api/notifications` with no `userId` every 30s; the route requires a userId and returns **400** each cycle — an infinite failing poll.
- **Do:** Pass a real `userId`, or make the hook skip fetching when the id is null.
- **Check:** Network tab shows no repeating 400s from the ops header.

### Step 2.3 — 🟡 Adopt the `timersRef` pattern at every uncleaned `setTimeout`→`setState` · M
- **Problem:** timers that update state with no cleanup (unmount mid-timer → state-after-unmount): `services/taxi/page.tsx:85-92`, `services/blood-bank/page.tsx:37-54`, `components/forms/homecare-reservation-form.tsx:56-66`, `doctors/[id]/page.tsx:65,80`, `components/shared/ecommerce/cart-drawer.tsx:19-31`, `surgery-booking-drawer.tsx:56`.
- **Do:** Track each timer id in a `useRef` and clear on unmount (copy `doctor-booking-drawer.tsx`). Also push the untracked `scrollIntoView` timer at `doctor-booking-drawer.tsx:212-214` into `timersRef` for consistency.
- **Check:** Trigger each flow then unmount before the timer fires → no warnings.

---

## Phase 3 — Re-render & runtime performance

### Step 3.1 — 🟠 Introduce Zustand selectors (fix whole-store subscriptions) · M
- **Problem:** No store is consumed with a selector — every consumer destructures the whole store and re-renders on any change. Worst: `cart.store.ts` consumers `product-card.tsx:13` and `cart-drawer.tsx:16` → every product card re-renders when any cart item changes. `getTotalPrice`/`getTotalItems` are derived getters stored on the store (recompute for all consumers).
- **Do:** Use field selectors: `useCartStore(s => s.items)`, `useCartStore(s => s.addToCart)`. Move derived totals into selectors, not store methods. Apply the same across `location.store` consumers.
- **Check:** React DevTools Profiler — editing one cart item no longer re-renders the whole product grid.

### Step 3.2 — 🟠 Memoize table columns feeding polled tables · S
- **Problem:** `src/app/(dashboard)/dashboard/page.tsx:57-65` rebuilds `taskColumns` with a fresh inline `render` closure every render; `CurrentTasksTable` isn't memoized → the full table re-renders every 30s poll tick.
- **Do:** `useMemo` the columns; wrap `CurrentTasksTable` (and `kpi-cards.tsx`) in `React.memo`.
- **Check:** Profiler — a poll tick that returns identical data doesn't deep re-render the table.

### Step 3.3 — 🟡 Hoist static config out of render bodies · S
- **Problem:** arrays/maps with inline JSX icons rebuilt every render (and every poll): `operations/page.tsx:41-52` (10 KPIs, 15s poll), `admin/page.tsx:37-46` (30s), `admin/monitoring/page.tsx:26-33` (10s), `(dashboard)/layout.tsx:12-23` (`entityNames`), plus option arrays inline in `doctors-directory` (`:531,:555`) and `offers/page.tsx:27`.
- **Do:** Move static parts to module scope; keep only the data-bound parts in render.
- **Check:** These identities are stable across renders (Profiler "why did this render").

### Step 3.4 — 🟡 Memoize derived lists · S
- **Problem:** derived collections recomputed inline each render: `offers/page.tsx:86` (`filteredOffers`), `doctors/[id]/page.tsx:53` (inline IIFE that `[...doctors].sort()` every render), repeated full-array `.filter()` passes in `trips/page.tsx:48-77` and the lab/pharmacy/radiology/sanad pipeline count scans (5–6× per render on a poll).
- **Do:** `useMemo` the derived arrays; fold multi-pass counts into a single reduce → one counts map.
- **Check:** Profiler shows no re-sort/re-filter on unrelated renders.

### Step 3.5 — 🟡 `React.memo` + hoist the Calendar primitive · S
- **Problem:** `src/components/ui/calendar.tsx:15-179` rebuilds a large `classNames`/`components` object (inline `Root`/`Chevron`/`DayButton` fns) on every parent render; `DayPicker` is heavy.
- **Do:** Wrap in `React.memo`; move static `components`/`formatters` outside render or into `useMemo`.
- **Check:** Opening a booking drawer with a calendar is snappier; fewer renders in Profiler.

### Step 3.6 — 🟡 Convert effectively-static pages to Server Components · M
- **Problem:** pages marked `'use client'` whose only interactivity is `router.push('/doctors')`: `labs`, `pharmacies`, `physiotherapy`, and `nursing` list pages, plus `(sanad)/wallet`. `notifications/page.tsx` is already a correct static RSC — use it as the model.
- **Do:** Drop `'use client'`, replace the navigation button with `<Link>`. (Fold into Phase 4's shared shell for the four provider pages.)
- **Check:** These pages ship less/no client JS (build output "First Load JS" drops); navigation still works.

### Step 3.7 — 🟡 Lazy-fetch admin partner detail tabs · M
- **Problem:** `src/app/(admin)/admin/partners/[id]/page.tsx:47-69` fires **6** `useDashboardData` calls on mount (partner, services, contract, wallet, performance, schedule) though only the `general` tab is visible — a 6-request waterfall. Same shape: `(dashboard)/dashboard/page.tsx` fires 6 on mount.
- **Do:** Fetch per active tab (only when selected); keep the first tab eager.
- **Check:** Network tab on load shows one tab's request, not six.

### Step 3.8 — 🟡 Add `sizes` to every `<Image fill>` · S
- **Problem:** `<Image fill>` without `sizes` downloads full-resolution: `offers/page.tsx:189`, `doctors-directory/page.tsx:260,344`, `complexes/[id]` carousels.
- **Do:** Add `sizes` matching the layout (e.g. `"(max-width:768px) 100vw, 33vw"`).
- **Check:** Network tab serves appropriately-sized images.

### Step 3.9 — ⚪ Swap remaining raw `<img>` for `next/image` · S
- **Problem:** `dashboard-header.tsx:110` and `dashboard-sidebar.tsx:147` use raw `<img>` avatars (also the 2 lint warnings).
- **Do:** Use `next/image` with explicit `width`/`height`.
- **Check:** `npm run lint` no longer reports `no-img-element`.

---

## Phase 4 — Code quality & deduplication (biggest structural win)

The single largest theme across both patient and dashboard/ops/admin: **near-identical UI copy-pasted across a dozen+ pages.** Extract shared components. Each extraction is one step; migrate callers incrementally.

### Step 4.1 — 🟠 Extract `<ProviderListPage>` for the 4 clone pages · M
- **Problem:** `pharmacies`, `nursing`, `physiotherapy`, `labs` patient pages are near-verbatim clones (FlexibleHeader + amber "referral lock" card + provider-card list). The referral-lock card is copy-pasted 4×.
- **Do:** Extract `<ReferralLockCard>`, `<ProviderCard>`, and a `<ProviderListPage>` shell (Server Component — combine with Step 3.6). Reduce each page to data + config. Removes ~300 lines.
- **Check:** All four pages render identically; one source of truth.

### Step 4.2 — 🟠 Extract `<DataTable>` / `<FilterBar>` / `<StatusPipeline>` · L
- **Problem:** the "search bar + status-count cards + table" scaffold is repeated across 12+ pages (dashboard patients/prescriptions/samples/imaging/trips/visits; operations orders/tracking/lab/radiology/pharmacy/sanad; admin partners/users/services/wallets/contracts). `components/dashboard/current-tasks-table.tsx` already generalizes the table but is used once.
- **Do:** Build `<FilterBar>`, `<StatusPipeline>`, `<DataTable columns rows loading empty>`. Migrate pages one at a time (one commit each).
- **Check:** Each migrated page matches its previous look; shared components covered by the migration.

### Step 4.3 — 🟠 Extract `<DateTimePicker>` + `<BookingSuccess>` · M
- **Problem:** the calendar + time-slot grid + "ملخص الحجز" block is duplicated 3× (`doctor-booking-drawer`, `doctors/[id]:199-301`, `bookings:336-462`); the green success screen is duplicated ~6× (booking drawer, doctors/[id], surgery drawer, taxi, blood-bank, homecare form).
- **Do:** Extract `<DateTimePicker>` and `<BookingSuccess>`; replace all copies.
- **Check:** Every booking flow uses the shared components; behavior unchanged.

### Step 4.4 — 🟡 Extract `<StaticSidebarLayout>` + parameterize dispatch panels · M
- **Problem:** `(operations)/layout.tsx` and `(admin)/layout.tsx` are the same file with different menu arrays. `operations/dispatch/page.tsx` has five `*Panel` components that are 90% identical (`fetch /api/partners?type=… → table`).
- **Do:** `<StaticSidebarLayout menu title accent>`; one `<PartnerDispatchTable type columns>`. Also extract `<FieldTaskCard>` shared by `trips`/`visits`.
- **Check:** Layouts and dispatch render unchanged; ~200 lines removed.

### Step 4.5 — 🟡 Decompose oversized pages · M
- **Problem:** single files too large to maintain: `doctors-directory/page.tsx` (606, holds 3 inline drawers), `bookings/page.tsx` (505), `admin/partners/[id]/page.tsx` (305, 7 inline tabs), `surgery-booking-drawer.tsx` (386), `taxi/page.tsx` (385), `blood-bank/page.tsx` (314).
- **Do:** Split drawers/dialogs/steps/tabs into their own files. Do after 4.1–4.4 so shared pieces are already extracted.
- **Check:** No page over ~250 lines; behavior unchanged.

### Step 4.6 — ⚪ Remove dead imports & dead code · S
- **Problem:** unused imports across `teleconsultation` (5 unused), `doctors/page.tsx`, `doctors/[id]`, `doctors/profile/[id]`, `complexes/[id]`, `trips` (`MapPin`,`Navigation`), `orders` (`Filter`), `dispatch` (`Star`,`Clock`,`MapPin`), `admin/partners/[id]` (`Save`,`Trash2`). Dead stores `dashboard-store.ts`, `ops-store.ts`, `sidebar-store.ts` (zero references). Dead `configs` fetch in `admin/pricing/page.tsx:13`.
- **Do:** Delete unused imports/stores/vars. `noUncheckedIndexedAccess`/lint from Phase 0 will surface most.
- **Check:** `npm run lint` clean; `grep` confirms deleted stores are unreferenced.

### Step 4.7 — ⚪ Consolidate the duplicated `.hide-scrollbar` style · S
- **Problem:** `<style dangerouslySetInnerHTML>` for `.hide-scrollbar` is injected in both `(sanad)/search/page.tsx:335` and `labs/page.tsx:195`.
- **Do:** Move the utility to `globals.css` once; remove the inline injections.
- **Check:** Scrollbars still hidden; no inline `<style>` in those pages.

---

## Phase 5 — Data-fetching & state architecture

Larger, optional-but-recommended. Do after Phases 0–2 stabilize the current approach.

### Step 5.1 — 🟠 Replace hand-rolled fetching with SWR (or React Query) · L
- **Problem:** every dashboard page hand-rolls `fetch`-in-`useEffect` + `setInterval`. No dedup, cache, or focus-revalidation. N components polling the same URL = N intervals + N in-flight requests; polling never pauses when the tab is hidden. Solves the cancellation gap (2.1), the dedup problem, and the loose `result.data ?? result` contract in one move.
- **Do:** Adopt SWR; replace `use-dashboard-data`/`use-kpi`/`use-notifications` internals with `useSWR` (dedup interval + `refreshInterval` + built-in abort). Keep the same hook signatures so pages barely change.
- **Check:** One request per URL regardless of consumer count; polling pauses on hidden tab; no manual abort code needed.

### Step 5.2 — 🟠 Make dark mode a single shared source · M
- **Problem:** `use-dark-mode.ts` holds independent `isDark` state per header (`ops-header` and `dashboard-header` desync); toggling one doesn't update the other; no `matchMedia('change')` listener. Also: `tailwind.config.ts` is `darkMode:["class"]` but `layout.tsx`'s `<html>` never gets a `dark` class → dark utilities are currently unreachable.
- **Do:** Promote dark mode to one Zustand store (or context) writing the `dark` class on `<html>`; subscribe to `matchMedia` change; persist choice.
- **Check:** Toggling in any header updates the whole app; `dark:` utilities take effect; system change respected.

### Step 5.3 — 🟡 Harden the auth type boundary · M
- **Problem:** `use-role.ts:9-11` and `lib/auth.ts:97-98` cast the session via `as Record<string,unknown>` / `as unknown as …` — an `any`-escape on the most sensitive data.
- **Do:** Add a `next-auth.d.ts` module augmentation typing `Session`/`JWT` (role, entity, ids); remove the casts.
- **Check:** `session.user.role` etc. are typed; no casts; `tsc` clean.

### Step 5.4 — 🟡 Add error handling + `Idempotency-Key` to mutations · M
- **Problem:** POST/PATCH actions swallow errors and lack the `Idempotency-Key` CLAUDE.md requires: `operations/orders/page.tsx:52-55` (accept/reject/hold), `admin/partners/[id]:72-81` (status), `use-notifications.ts` markAsRead.
- **Do:** Add try/catch + toast + pending/disabled state + optimistic update where sensible; send an `Idempotency-Key` header.
- **Check:** A forced-failure mutation shows an error and doesn't leave stale UI; retries are idempotent.

### Step 5.5 — ⚪ De-duplicate shared types · S
- **Problem:** two `Doctor` interfaces (`types/patient/index.ts:5` vs `doctor-booking-drawer.tsx:9-16`) and two different `SearchResult` types (`types/dashboard.ts:444` vs `types/patient/index.ts:84`).
- **Do:** Make the drawer use `Pick<Doctor,…>`; rename/merge the `SearchResult` types.
- **Check:** One canonical `Doctor`; no name-collision imports.

---

## Phase 6 — Accessibility & polish

### Step 6.1 — 🟡 Make clickable `<div>`s real buttons · S
- **Problem:** interactive `<div onClick>`/`role="button"` without keyboard support: `doctor-booking-drawer.tsx:206-216` (date cards), `bookings/page.tsx:302-328,482-499`.
- **Do:** Use `<button>` (or add `role`, `tabIndex`, key handlers); resolve the nested-button in the date card into one accessible control.
- **Check:** Every action is keyboard-reachable and announced.

### Step 6.2 — 🟡 Add missing `alt` text · S
- **Problem:** `next/image` without `alt`: `dashboard/imaging/page.tsx:133`, `operations/radiology/page.tsx:28` (also lint warnings).
- **Do:** Meaningful `alt` (or `alt=""` if decorative).
- **Check:** `npm run lint` no `alt-text` warnings.

### Step 6.3 — 🟡 Replace blocking `alert()` calls · S
- **Problem:** native `alert()` for UX: `pwa/install-prompt.tsx:54` (iOS fallback), `services/taxi/page.tsx:76` (validation).
- **Do:** In-app sheet/toast/inline error consistent with the RTL design.
- **Check:** No `alert(`` in `src/`.

### Step 6.4 — 🟡 Fix `useFormField` guard ordering · S
- **Problem:** `components/shared/forms/form.tsx:37-43` — uses `fieldContext.name` (`:37`) before the `if(!fieldContext) throw` guard (`:39`); `itemContext` is never guarded.
- **Do:** Move guards above first use; guard `itemContext`.
- **Check:** Using a field outside its provider throws a clear error, not a raw TypeError.

### Step 6.5 — ⚪ Resolve the PWA: finish it or remove it · M
- **Problem:** `install-prompt.tsx` markets "تثبيت تطبيق سند" but there's **no `manifest.json`, no service worker, no manifest metadata** in `layout.tsx` — `beforeinstallprompt` never fires; it's currently commented out at `layout.tsx:30` (with a dead import at `:3`).
- **Do:** Either add a real manifest + registered service worker (+ `manifest`/`theme-color`/`apple-touch-icon`) or remove the component and dead import.
- **Check:** Either the install prompt actually fires, or the dead code is gone.

### Step 6.6 — ⚪ Tidy Tailwind config · S
- **Problem:** `tailwind.config.ts` `content` globs include non-existent `./pages`, `./components`, `./app` roots (this is a `src/`-based project).
- **Do:** Trim globs to `./src/**`.
- **Check:** Build unaffected; config reflects reality.

### Step 6.7 — ⚪ Replace `alert`-style Arabic pluralization & minor guards · S
- **Problem:** simplistic pluralization (`doctors-directory:210 {docCount>10?'طبيب':'أطباء'}`) is wrong for 1–2; `location.split(' - ')[1]` (`:294`) renders `undefined` without a guard; blood-bank "show all donors when none match" (`:42`) is misleading.
- **Do:** Proper Arabic plural rules; guard the split; show an honest empty state.
- **Check:** Correct labels for counts 1/2/many; no `undefined` in the UI.

---

## Suggested execution order (milestones)

1. **Milestone A — Foundation:** Phase 0 (all). One PR. Unblocks lint/types for everything else.
2. **Milestone B — It works:** Phase 1 + Steps 2.1, 2.2. Fixes broken/misleading features + the top leak. Highest user-visible value.
3. **Milestone C — Fast & clean:** Phase 2 (rest) + Phase 3. Leaks and re-renders.
4. **Milestone D — Maintainable:** Phase 4. The big dedup refactor (largest LOC reduction).
5. **Milestone E — Architecture:** Phase 5. SWR + dark mode + auth types.
6. **Milestone F — Polish:** Phase 6.

## Quick reference — Critical/High items only

| Step | Sev | What |
|---|---|---|
| 1.1 | 🔴 | Commissions module-constant mutation |
| 1.2 | 🔴 | Radiology sidebar dead-end routing |
| 2.1 | 🔴 | `use-dashboard-data` no AbortController (25 pages) |
| 0.1 | 🟠 | Broken `npm run lint` |
| 0.3 | 🟠 | React 19 vs `@types/react` 18 |
| 1.3 | 🟠 | Medical-record feature non-functional |
| 1.4 | 🟠 | Dead rebook/cancel actions |
| 1.5 | 🟠 | Broken click-to-call links |
| 1.6 | 🟠 | Status badge colors lost |
| 2.2 | 🟠 | Infinite failing notifications poll |
| 3.1 | 🟠 | Zustand whole-store subscriptions |
| 3.2 | 🟠 | Polled tables re-render fully |
| 3.7 | 🟡→ | Partner detail 6-request waterfall |
| 4.1–4.3 | 🟠 | Extract shared Provider/DataTable/Booking components |
| 5.1 | 🟠 | Adopt SWR for data fetching |
| 5.2 | 🟠 | Single shared dark-mode source |

---
*This plan is analysis + sequencing only — no source files were modified. Each step is independently committable and verifiable.*
