# Master Implementation Plan — Doctor App (وريد / سند)

> **Version 2.0 · 2026-07-26** — supersedes the earlier standalone plans.
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Prisma 7 · PostgreSQL (Supabase) · NextAuth v5-beta · Tailwind 3
> **Constraint that shapes this plan:** a **mobile app will consume this same API**. Auth strategy, response contracts, and the data model are all far cheaper to fix now than after a mobile binary ships to a store.

## Supporting documents
| Doc | What's in it |
|---|---|
| `FINAL_SWEEP_AUDIT.md` | **Read first.** CVEs, routing integrity, auth UX, business logic, RTL/a11y, build, ops, legal |
| `API_MOBILE_AUDIT.md` | API security, contracts, schema, mobile-parity evidence |
| `FUNCTIONAL_COVERAGE_AUDIT.md` | Per-screen CRUD/search/filter/pagination/loading/error/toast matrix |
| `FRONTEND_IMPLEMENTATION_PLAN.md` | Frontend code-quality, re-render, memory-leak, perf detail |

---

## 🚨 Do these four things today (10 minutes, before Step 1)

None is a project — all are one-line fixes to live risk:

1. **Revoke the GitHub token.** `token.md` holds a live **GitHub PAT in plaintext** in the project root. It's gitignored and was never committed, but it's readable by any process, backup, or screen-share. → Revoke at github.com/settings/tokens, delete the file, use `gh auth login`.
2. **Patch the two auth CVEs.** `next-auth@5.0.0-beta.31` has **GHSA-8fpg-xm3f-6cx3: existence-based auth checks fail open** — and `middleware.ts:26` (`if (!session?.user)`) is exactly that pattern, on the only authz layer for `/admin`, `/operations`, `/dashboard`. `next@16.2.6` separately carries a Turbopack + single-locale middleware-bypass advisory, and this app is that exact configuration. Both fixes are patch-level: `beta.32` and `16.2.12`. (A Vercel CVE-patch branch already exists in the remote, unmerged.)
3. **`.env` is not gitignored.** `.gitignore` only covers `.env*.local`. `.env` holds the live `DATABASE_URL` (password inline), `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `ULTRAMSG_TOKEN`.
4. **`prisma/` is entirely untracked.** The schema — 722 lines, 35 models — exists only on this machine.

```bash
cd "/Users/ahmed/Desktop/doctor app" && printf '\n.env\n' >> .gitignore && rm token.md && npm audit fix && git add prisma/ .gitignore && git status --short
```

> Use plain `npm audit fix` — **not** `--force`, which would downgrade `shadcn` by a major version.

---

## The situation in one page

**The app looks ~90% built and is ~20% functionally wired — and the API is completely unprotected.**

| Layer | State |
|---|---|
| **API security** | 🔴 **0 of 68 routes authenticate.** `middleware.ts` matcher covers `/dashboard`, `/admin`, `/operations` — **not `/api/*`**. Every endpoint is public: patient medical records, prescriptions, lab results, wallets, users, commissions. Only 1 route ever returns 401. |
| **API validation** | 🔴 **0 routes use Zod.** 31 of 45 mutating handlers pass raw `body` into Prisma → mass assignment. `PATCH /api/users/[id]` with `{"role":"SUPER_ADMIN"}` is full takeover. |
| **API contract** | 🟠 `{data}`/`{error}` convention holds on the happy path only. 77 errors are the identical string `"فشل"`. No error codes, no versioning, no OpenAPI, no idempotency, no rate limiting. |
| **Data model** | 🟠 35 models, well-shaped overall — but **1 index in the whole schema**, **0 `Decimal`** (14 money fields are `Float`), **no migrations**, no tenancy scoping, no attachment model, no lat/lng. |
| **Backend reads** | 🟢 Mostly real and working (dashboard KPIs, ops lists, admin lists are live Prisma data). |
| **Frontend writes** | 🔴 **5 of ~40 mutation endpoints are wired.** No create/delete UI anywhere. Patient booking flows all fake success with `setTimeout`. |
| **Frontend infra** | 🔴 No toast system, zero `loading.tsx`, zero `error.tsx`, pagination on 2 pages. |
| **Build health** | 🟢 `next build` succeeds, `tsc` clean, 0 `any`. But every route ships ~200 kB gzip, and the static/dynamic split is inverted (patient-data pages are prerendered static). |
| **Business logic** | 🔴 **The Commission Engine — the client's headline feature — does not exist.** Hardcoded React state under a banner claiming otherwise. `Order` has no money field; no code writes a wallet balance; no `$transaction` anywhere. **5 incompatible `serviceType` vocabularies** mean any engine written today matches zero rows. |
| **Auth UX** | 🔴 **3 of 9 roles (including the default PATIENT) cannot complete a login** — `/unauthorized` doesn't exist. **Logout does not exist** (`signOut` never imported). 24/35 sidebar links and 13/13 quick actions are 404. |
| **Ops** | 🔴 Zero tests, zero CI, zero observability (82 swallowed errors), no migrations, no backups. `git push` is the deploy pipeline. |
| **Mobile/legal** | 🔴 **No native app exists** (no iOS/Android/Capacitor project, not even a PWA manifest). No privacy policy, no account deletion → automatic store rejection. |

**Mobile readiness: not viable today.** Beyond the security hole, there is no bearer-token auth (NextAuth cookies can't serve a native client), no patient-scoped endpoints (`/api/orders` has no `patientId` filter), the entire patient catalog exists only in a frontend demo file, and there's no push/media/geo/config infrastructure.

---

# The 10 Steps

Each step has **one focus**. Complete it, verify it, commit it, then move on.

Sequencing note: **Steps 1–2 are blocking and urgent.** Steps 3–7 are the API/mobile track. Steps 8–10 are the frontend track and **can run in parallel with 3–7** by a different developer — they touch different files.

---

## Step 1 — Lock down the API perimeter
**One thing: make every endpoint require a verified identity.**

🔴 Critical · Effort: 3–4 days · Blocks everything

Right now anyone on the internet can read and modify patient medical records. This is the only step that matters until it's done.

**Do:**
1. Build one `requireAuth(req, {roles?})` helper returning `{userId, role, partnerId}`. It reads a NextAuth cookie session **or** a `Bearer` token, so it works for both web and (later) mobile.
2. Build a `withAuth()` route wrapper that fails closed — an uncaught error returns 401/500, never data.
3. Apply it to all 68 handlers. Add `/api/:path*` to the middleware matcher as defence-in-depth (**not** as the only gate — middleware has a history of bypass primitives).
4. Add ownership/tenancy checks to every `[id]` route. Auth alone turns these from "public" into "any logged-in user" — which, with self-service patient registration, is barely better. Full IDOR inventory is in `API_MOBILE_AUDIT.md`.
5. Delete the `?role=` / `?partnerId=` query params on `/api/dashboard/*` — the client currently **declares its own role**. Derive both from the token.
6. Add a CI check that fails the build if any `route.ts` outside `/api/auth/*` doesn't import the wrapper. This is what keeps it fixed.

**Also in this step — the auth flow is broken end to end, not just the API:**
- **Create `/unauthorized`** (+ a root `not-found.tsx`). Middleware redirects there and **the route doesn't exist**, so every role mismatch is a raw 404.
- **Add per-role landing routing.** `login/page.tsx:61,72` hardcodes `/dashboard` for everyone, so **PATIENT (the default role for every new user), SUPER_ADMIN, and OPERATIONS all 404 immediately after a successful login.** Add `PATIENT` to `roleRoutes`.
- **Implement logout.** `signOut` is exported at `auth.ts:7` and **never imported** — all three logout buttons are dead. There is currently no way to log out.
- **Fix the failed-login-reads-as-success bug** at `login/page.tsx:53` — `result?.error` is the wrong next-auth v5 guard; use `!result?.ok || result.url === null`.
- **Read `callbackUrl`** (written by middleware, never read) so deep links work.
- Enforce `User.isActive` in `authorize()`; remove auto-provisioning from `lib/auth.ts`; stop `use-role.ts:9` silently degrading an expired session to `PATIENT`.
- Fix `middleware.ts:18-20` bare `startsWith` (`/dashboardfoo` matches `/dashboard`), and rename `middleware.ts` → `proxy.ts` (deprecated in Next 16 — a silent break here is a fail-open).

**Check:** `curl` any endpoint without credentials → 401. A patient token requesting another patient's record → 403. Every one of the 9 roles logs in and lands on a real page. Logout works. CI rejects a new unguarded route.

**If this API has been publicly reachable with real patient data, treat it as a breach:** rotate every credential in `.env` and assume disclosure.

---

## Step 2 — Validate every input
**One thing: no request body reaches Prisma unvalidated.**

🔴 Critical · Effort: 2–3 days · Depends on Step 1

Zod is already a dependency and used in zero routes. 31 handlers spread raw `body` into Prisma.

**Do:**
1. One Zod schema per mutating endpoint, `.strict()` so unknown keys are rejected.
2. `schema.safeParse(await req.json().catch(() => null))` — this also fixes the 42 unguarded `req.json()` calls that currently return **500 on malformed JSON** (the most common mobile failure mode).
3. Never pass `body` to Prisma; construct the `data` object explicitly. `orders/route.ts:52-71` already does this correctly — use it as the model.
4. Clamp pagination: `Math.min(Math.max(1, parseInt(x) || 20), 100)`. Today `?pageSize=1000000` dumps the table and `?page=abc` → `NaN` → 500.
5. Fix `partners/[id]/schedule` PUT: it runs `deleteMany` *then* an unguarded `.map`, with no transaction — a malformed body **wipes the doctor's schedule and then 500s**.

**Priority order:** `wallets/[partnerId]/transfers` (mints money — and the `{walletId, ...body}` spread lets a client override the target wallet), `users/[id]` (role escalation), `medical-records/[patientId]` and `prescriptions/[id]` (patient safety).

**Check:** every mutating endpoint rejects an unknown field with 400 + field-level detail; malformed JSON returns 400 not 500.

---

## Step 3 — Fix the data foundation
**One thing: a reproducible, migratable, correctly-typed schema with ONE service vocabulary.**

🔴 Critical · Effort: 4–5 days

> **Do the `serviceType` unification first — everything financial depends on it.** The codebase uses **five mutually incompatible `serviceType` vocabularies**: `Order` (`HOME_VISIT`/`ONLINE`/`X_RAY`), `CommissionRule` (`استشارة حضورية`), `PriceConfig` (`فحص CBC`), `ServiceConfig` (`حضوري`), `Contract.services` (`CBC`). **A pricing or commission engine written today would match zero rows for every order in the database.** Replace all five with one `ServiceType` enum (or a `Service` table) with FKs from every consumer.

No migrations exist and `prisma/` isn't even in git. The schema was applied with `db push`, so dev/staging/prod can silently diverge and there is no rollback path.

**Do:**
1. Track `prisma/`, then baseline an initial migration:
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
   npx prisma migrate resolve --applied 0_init
   ```
   Verify with `prisma migrate diff --from-schema-datasource --to-schema-datamodel` → no changes. Remove `db push` from every workflow.
2. Wire `directUrl` (`DIRECT_URL` exists in `.env` but isn't in `prisma.config.ts`) — migrations through a pooler are unreliable.
3. **Money → `Decimal`.** All 14 monetary fields are `Float` today. Commission math multiplies five share percentages together; IEEE-754 drift on real IQD is a correctness bug. Add an explicit `currency` field.
4. **Add indexes.** The schema has exactly **one** `@@index`. Every filter, sort and join in 86 query sites is unindexed. Full index list in `API_MOBILE_AUDIT.md` — start with `Order`, `Notification`, `Transaction`, `Partner`, `Appointment`.
5. Convert the 17 FK-shaped `String` fields into real relations — without them, tenancy is unenforceable.
6. Add `updatedAt` (19 models lack it) and `deletedAt` — prerequisites for mobile delta-sync.
7. **Add the money model that doesn't exist:** `Order.subtotal/discountTotal/totalAmount/currency`. Today `Order` has **no monetary field at all** — there is literally nothing to price or split. Add a platform account so `waridShare` has a payee (`Wallet.partnerId` is required+unique and Warid isn't a Partner).
8. Replace `CommissionRule`'s five fixed role columns with a party table so an arbitrary number of payees is expressible, with a constraint that shares sum to 100%, plus `validFrom`/`validTo` so historical orders don't re-split at today's rates.
9. **Fix the seed** (`prisma/seed.ts`): 8 models use bare `create` → **37 duplicate rows per re-run**; 12 models are unseeded (which is *why* the dashboards render empty — `Transaction` being absent makes every earnings KPI 0); `Contract.services` etc. are double-encoded via `JSON.stringify` into `Json` columns so consumers get a string not an array; add a `NODE_ENV` guard (it creates a `SUPER_ADMIN` and prints the roster); add `prisma.seed` to `package.json` and `tsx` as a dep.
10. Fix the `doctorId` ↔ `partnerId` ID-space mismatch (`summary/route.ts:34,41,49` passes a `Partner.id` where a `DoctorProfile.id` is expected) — **this is why all doctor KPIs are permanently 0** — and add the missing `partnerId` filter to the LAB/RADIOLOGY KPI queries, which currently leak counts across tenants.

**Check:** `migrate deploy` reproduces the schema from scratch; money columns are `Decimal`; one service vocabulary joins cleanly across `Order`/`PriceConfig`/`CommissionRule`/`ServiceConfig`; re-running the seed twice produces identical row counts; doctor KPIs show non-zero.

---

## Step 4 — Standardise the API contract
**One thing: every endpoint answers in the same shape, with machine-readable error codes.**

🟠 High · Effort: 3–4 days · Do before mobile codes against it

77 of 144 errors are the identical Arabic string `"فشل"`. A client cannot distinguish "not found" from "database down". Arabic strings are currently *the contract* — a mobile app can never localise.

**Do:**
1. One `ok(data, meta)` / `fail(code, status, details)` pair applied to all 107 handlers:
   ```jsonc
   { "data": …, "meta": { "requestId": "…", "page": { "nextCursor": "…", "hasMore": true } } }
   { "error": { "code": "ORDER_NOT_FOUND", "message": "…", "details": [...], "requestId": "…" } }
   ```
   `error.code` is stable SCREAMING_SNAKE and the **only** thing clients branch on.
2. Map Prisma errors properly: `P2025 → 404`, `P2002 → 409`, `ZodError → 400`. Today `GET /api/orders/{bogus}` returns 404 but `PATCH` on the same id returns **500** — mobile retry logic keyed on 5xx will retry forever.
3. **Cursor pagination everywhere**, `limit` capped at 100. Every list is `orderBy: createdAt desc`, so offset paging duplicates and skips rows as new records arrive — already a live defect.
4. Move enum-shaped `String` columns to real Prisma enums. `PATCH /api/lab-samples/{id}` with `{"status":"banana"}` currently succeeds and corrupts the row. This also fixes two KPIs that are permanently 0 from casing mismatches (`dashboard/summary:48`, `:164`).
5. Never emit `undefined` — `dashboard/summary:93` drops the `change` key depending on data, which intermittently breaks typed Swift/Kotlin decoders.

**Check:** a generated client decodes every endpoint with one success and one error type; no Arabic string is load-bearing.

---

## Step 5 — Add token auth for mobile
**One thing: a native client can log in, stay logged in, and be logged out.**

🟠 High · Effort: 3–5 days · Depends on Steps 1, 4

NextAuth stores its JWT in an httpOnly cookie. No endpoint returns a token; `POST /api/auth/otp/verify` deliberately does *not* sign in. A native app cannot authenticate at all today.

**Do:**
1. `RefreshToken` model storing only a SHA-256 hash, with `familyId` for rotation lineage.
2. 15-minute access JWT (claims: `sub`, `role`, `partnerId` — **no PHI**, JWTs are only base64) + 60-day rotating opaque refresh token. Opaque refresh is what makes revocation possible; today's 30-day cookie JWT can't be revoked at all.
3. Endpoints: `otp/request`, `otp/verify` (issues the pair), `refresh`, `logout`, `logout-all`.
4. **Re-read the user from the DB on every refresh** — this fixes the staleness bug where a demoted admin keeps privileges for up to 30 days.
5. **Reuse detection:** presenting an already-rotated token means theft → revoke the whole family.
6. Set NextAuth `maxAge` explicitly and decide `trustHost` rather than relying on inference.

**Harden the OTP flow in the same step** — it's the mobile login path and currently: uses `Math.random()` (not a CSPRNG, so codes are predictable from observed outputs), has **no rate limit** on send or verify, **never invalidates prior codes** (N sends = N valid codes), has **no attempt counter**, and `/verify` never marks the code used so it replays until expiry. Add `attempts`/`consumedAt` columns, consume atomically via `updateMany` + row count, rate-limit send (3/hr/phone) and verify (5 attempts), and **delete the standalone `/api/auth/otp/verify`** — it is a free oracle for testing candidate codes.

**Check:** a `curl` OTP flow returns a working bearer token; `logout-all` invalidates it immediately; 6 wrong codes locks out.

---

## Step 6 — Build the versioned mobile API surface
**One thing: `/api/v1/*` — a stable, documented, patient-scoped contract.**

🟠 High · Effort: 2–3 weeks · The main mobile deliverable

Two structural problems make the current routes unusable for mobile: they're **UI-shaped** (`/api/dashboard/summary` returns Tailwind colour names, Lucide icon names and web `href`s) and they're **not patient-scoped** (`/api/orders` has no `patientId` filter; `LabSample` has no `patientId` field at all). Roughly 23 patient features have no endpoint whatsoever — the whole catalog lives in `src/lib/constants/demo-data.ts`.

**Do:**
1. Extract business logic into `src/server/services/*` (framework-free). Route handlers become ~10 lines: parse → authorize → call service → envelope. Both `/api/*` and `/api/v1/*` call the same services, so web and mobile can't drift.
   **This is where the missing domain logic gets built** — there is no service layer at all today:
   - **The Commission Engine.** `resolveCommissionRule` → `computeSplit` (Decimal, deterministic remainder) → `settleOrder` (one `$transaction`: write splits, write balanced ledger entries, increment wallets, log activity, idempotent on a key) → `reverseSettlement` for refunds. Then rewrite `admin/commissions/page.tsx` against the real API — today it's hardcoded React state under a banner claiming percentages are contract-driven.
   - **Pricing resolution** with a documented precedence between `PriceConfig`, `Contract.minPrices`, campaigns and coupons — plus coupon redemption (a `CouponRedemption` table; `usedCount` is never incremented today, so `maxUses` and per-user limits are unenforceable).
   - **An order state machine.** Today status jumps arbitrarily, `PATCH /orders/[id]` bypasses everything, **`assign` always writes `step:3` so multi-party dispatch is impossible** (the requirement's own lab+nurse+driver example fails), and **8 of the 11 timeline steps have no writer** — no endpoint ever reaches `COMPLETED`, which is the trigger settlement needs.
   - **Booking safety:** double-booking/overlap checks, `dailyCapacity` and `ServiceConfig.status` enforcement, server-derived `Appointment.price` (it's client-supplied today).
   - **A `PatientFeedback` create endpoint** — feedback can never be submitted today, so `Partner.rating` can never be computed and the "best doctors" report ranks by seed data.
2. Build `/api/v1/*` per the endpoint list in `API_MOBILE_AUDIT.md`:
   - **Catalog:** specialties, doctors (+ availability, reviews), labs, pharmacies (+ products), complexes, surgeries, offers, packages, governorates
   - **`/me/*`:** appointments, orders (+ timeline), prescriptions, lab-results, radiology, medical-record, notifications, wallet, addresses, favorites
   - **Actions:** book, reschedule, cancel, feedback, cart/checkout
3. New models the catalog needs: `Specialty`, `Product`, `Address`, patient `Wallet` (today `Wallet` is `partnerId @unique` — structurally partner-only).
4. Generate **OpenAPI 3.1 from the Zod schemas** so the spec can't drift. This is what the mobile team codes against — they can start from a mock server on day one.
5. Add `Idempotency-Key` on every POST that creates money, orders, or messages. Mobile retries on flaky cellular otherwise double-book.

**Recommendation:** build `/api/v1` inside this Next.js app, not a separate BFF — a standalone service would need its own deploy, Prisma pool, and auth verification for no isolation benefit at this team size. Keep the legacy unversioned routes serving the web app untouched; migrate them later.

**Check:** the OpenAPI spec generates a client that completes signup → browse → book → track without touching a legacy route.

---

## Step 7 — Add the mobile platform services
**One thing: push, media, geo, and release control.**

🟡 Medium · Effort: 1–2 weeks · Depends on Step 6

**Do:**
1. **Push:** `DeviceToken` model, `POST/DELETE /api/v1/devices`, add `PUSH` to `NotificationChannel`, FCM v1 + APNs dispatcher, typed `Notification.type` for deep links. **Bodies must be generic** ("نتيجة تحليل جاهزة" with no result content) — these appear on lock screens. Revoke the token on logout or the next user of that handset receives the previous user's PHI.
2. **Media:** `supabase-storage.ts` exists but is imported by **nothing**. Build signed upload URLs + commit + short-TTL signed download (≤5 min), never proxying files through a route handler. Make `lab-results`/`radiology-images` **private buckets** and delete `getFileUrl()` — it returns permanent public URLs, which for PHI means world-readable forever. Enforce type/size server-side; strip EXIF GPS.
3. **Geo:** `GET /api/v1/geo/governorates` (the `Governorate` model exists with no route), add `lat`/`lng` to `Partner` and `Order` — there is no coordinate column anywhere today, so "nearest doctor" and the map pin are unimplementable.
4. **Release control:** `GET /api/v1/app/config` (min supported version, maintenance mode, feature flags) and `GET /api/v1/health`. **Build these before the first store submission** — without them a bad release can't be recovered.
5. **Timezone:** "today" is computed as server-local (UTC on Vercel) in 4+ routes. Iraq is UTC+3, so today's appointments are wrong for three hours every night. Collapse `Appointment.date` + `time` into one UTC `startsAt` and compute day boundaries in `Asia/Baghdad`.
6. **Rate limiting** globally, plus security headers in `next.config.ts` (HSTS, CSP, `Referrer-Policy: no-referrer` — patient IDs currently leak via referrer).

**Check:** a test device registers, receives a push, uploads and retrieves a file via signed URL, and is force-updated by `app/config`.

---

## Step 8 — Build the frontend feedback foundations
**One thing: the UI can express loading, error, and success.**

🔴 Critical for UX · Effort: 2–3 days · **Can start immediately, in parallel with Steps 3–7**

There is no toast system, zero `loading.tsx`, and zero `error.tsx` in the entire app. Wiring CRUD before this exists produces actions that succeed or fail invisibly.

**Do:**
1. Install `sonner`, mount `<Toaster>` in root layout (RTL-aware), export a `toast` helper.
2. Add `error.tsx` (with retry) + `loading.tsx` per route group, and a root `not-found.tsx`.
3. Build a `useMutation` helper: manages `isPending`/`error`, calls the endpoint, fires success/error toasts, triggers refetch. **Every step-9 action uses this.**
4. Add `AbortController` + a mounted guard to `use-dashboard-data` (used by ~25 pages; currently sets state after unmount and races). Ship a shared `<QueryState loading error empty>` wrapper so lists stop swallowing failures — today almost no page renders the hook's `error`.

**Check:** a forced 500 shows an error toast and a retryable error boundary, not a blank screen.

---

## Step 9 — Wire the frontend to the real API
**One thing: every button that looks functional actually is.**

🟠 High · Effort: 3–4 weeks · Depends on Steps 8, 4

Only 5 of ~40 mutation endpoints are wired. Full per-screen matrix in `FUNCTIONAL_COVERAGE_AUDIT.md`.

**Do, in this order:**
1. **Fix silently-broken reads first.** All six dashboard sub-pages fetch endpoints that **don't exist** (`/api/dashboard/prescriptions` — the real route is `/api/prescriptions`), so they load permanently empty and, with no error state, it looks intentional. Also: implement the `earnings` endpoint (a TODO stub returning zeros), emit all 5 alert types (only 2 are produced), and **render `ops-header`** — it's fully built but never mounted, so the entire Operations header requirement is off-screen.
2. **Wire the core action loops** through the step-8 mutation helper: ops dispatch **assign** (the primary operations action — every button has no `onClick`), order transfer, pipeline stage-advance (lab/pharmacy/radiology/blood-bank/sanad), admin partner CRUD (the "add partner" CTA 404s), the **Commission Engine** (currently local `useState` that never persists — the client calls this the most important feature), user CRUD.
3. **Patient booking submission** — every flow (doctor, surgery, homecare, taxi, blood-bank, cart) fakes success with `setTimeout` and never POSTs. Reschedule and cancel confirm buttons mutate nothing, so the app silently lies to users.
4. Add pagination to every list, activate or remove the ~10 decorative search/filter inputs, and add empty states where tables render bare `<tbody>`.
5. **Repair navigation.** 24 of 35 sidebar links and **13 of 13 quick actions are 404s**; RADIOLOGY has exactly one working link (its real page `/dashboard/imaging` is orphaned while the sidebar points at a nonexistent `/dashboard/requests`). Either build the missing pages or remove the links — every role currently has dead `المالية`/`الإشعارات`/`الإعدادات` entries. Also move `BottomNavbar` out of the root layout into `(patient)/layout.tsx` (a patient nav bar currently renders on `/login`, `/admin/*`, and `/operations/*`), and fix the tracking page's comma-joined status filter, which 500s so the 11-step timeline is permanently empty.

**Check:** a booking made on the patient app appears in `(sanad)/bookings`, in the doctor's dashboard, and in the ops queue. Every visible nav link resolves.

---

## Step 10 — Optimise rendering and performance
**One thing: no wasted renders, no leaks, no duplicated UI.**

🟡 Medium · Effort: 1–2 weeks · Best done last — Step 9 rewrites much of this code

Detail in `FRONTEND_IMPLEMENTATION_PLAN.md`.

**Do:**
1. **Fix leaks:** the uncleaned `setTimeout`→`setState` sites (taxi, blood-bank, homecare form, doctors/[id], cart drawer). Copy the correct `timersRef` pattern already used in `doctor-booking-drawer.tsx`. Stop the infinite failing notifications poll (`useNotifications(null)` → 400 every 30s).
2. **Fix re-renders:** add Zustand selectors (no store uses them — every consumer re-renders on any change), memoize polled table columns, hoist static config out of render bodies, `React.memo` the Calendar primitive.
3. **Deduplicate:** extract `<DataTable>` / `<FilterBar>` / `<StatusPipeline>` (repeated across 12+ pages), `<ProviderListPage>` (4 clone pages), `<DateTimePicker>` / `<BookingSuccess>` (duplicated 3× and 6×). Decompose the 6 pages over 300 lines.
4. **Perf:** convert static pages to Server Components, add `sizes` to `<Image fill>`, lazy-fetch admin partner tabs (6 eager requests on mount).
5. **Build health:** fix the broken `npm run lint` script (`next lint` is removed in Next 16 and chokes on the space in the folder path), align `@types/react` to v19, remove `legacy-peer-deps`, drop the unused `recharts`.
6. **Make the staff portals usable on a phone.** `grep 'md:hidden'` returns **zero hits app-wide** — the 256px sidebars never hide, so at 360px the sidebar covers 71% of the viewport and content gets a 104px column. Add a responsive drawer; lift the sidebar's `isCollapsed` state to the layout (it currently desyncs from a hardcoded `mr-64`, leaving a 188px gap). **Add `overflow-x-auto` to 18 of 20 tables** — they sit in `overflow-hidden` wrappers that silently clip columns.
7. **Accessibility:** 47 form controls have only 2 `htmlFor` between them; ~15 icon-only buttons have no accessible name; 2 drawers lack a `DrawerTitle`; `services/surgeries:79` renders body text at **1.47:1 contrast**. Add a skip-link.
8. **Fix the currency bug:** admin screens display **`ر.ي` (Yemeni Rial)** for the same wallet balances the patient app shows as **`د.ع` (Iraqi Dinar)** — 11 occurrences. Standardise on `ar-IQ` (`ar-EG` renders يوليو where Iraq uses تموز) and route all money through one `Intl.NumberFormat` helper.
9. Fix the 8 genuinely-wrong RTL sites (the `ArrowLeft` beside `رجوع` at `login:189`, `md:text-left` in the shared drawer, the dialog close button, the fake no-op `dir-ltr` class) and migrate physical→logical properties opportunistically. Most of the ~280 physical usages render correctly under fixed RTL — this is debt, not breakage.

**Check:** React Profiler shows no full-table re-render on a poll tick; `npm run lint` runs clean; the admin dashboard is usable at 360px; money shows one currency everywhere.

---

# Execution

## Two parallel tracks after Step 2

```
Week:      1────2────3────4────5────6────7────8────9────10───11───12
BLOCKING:  [1 Auth][2 Valid]
API/Mobile:          [3 DB][4 Contract][5 Token][──6 /api/v1──][7 Platform]
Frontend:            [8 Foundations][────────9 Wire CRUD────────][10 Perf]
```

Steps 1–2 gate everything. After that the API track (3→7) and frontend track (8→10) touch different files and can run concurrently with two developers. Step 9 needs Step 4's contract to be settled.

## Running alongside — the operational floor

These aren't steps; they're standing requirements. Establish them early or the 10 steps land on sand.

| Need | Why now | Minimum viable |
|---|---|---|
| **Observability** | **82 `catch` blocks bind the error and never use it**; 77 endpoints return the bare string `"فشل"`; 28 `console` calls across 68 routes. A production incident today is undebuggable — the stack trace is destroyed inside the catch. | Sentry (`@sentry/nextjs`, ~1h) with a `beforeSend` that **scrubs PHI**; one shared `apiError()` helper replacing all 82 sites; request IDs; `GET /api/health`. |
| **Tests** | Zero exist. 68 routes, 35 models, all unverified. | **Vitest.** Highest-leverage first artifact: one table-driven test asserting **401 unauthenticated across all 68 routes** — it fails 68 times today and each Step-1 fix flips one green. Then the middleware authz matrix, including a case where `req.auth` is a truthy *error* object (covers the fail-open CVE). Gate: no new route without an authz test. |
| **CI/CD** | No `.github/`, no `vercel.json`. **`git push` to `main` is the deploy pipeline** — no lint, build, review, or staging gate between a laptop and production PHI. | Protect `main`; PR + 1 approval; CI runs `lint` → `tsc --noEmit` → `test` → `build`. Then: backup gate → `prisma migrate deploy` → deploy → smoke-test `/api/health`. |
| **Backups** | No scripts, no runbook, no evidence PITR is on, no restore ever tested. Combined with `db push` (which treats a rename as drop+add), a bad schema change is **unrecoverable PHI loss**. | Supabase Pro + PITR; nightly `pg_dump` to a different provider, 30-day retention; a **quarterly restore drill**; written RPO/RTO. |
| **Secrets** | No `.env.example`; `.env`/`.env.local` are byte-identical duplicates and both load; `SUPABASE_SERVICE_ROLE_KEY` and `…ANON_KEY` are read by code but not defined (all Supabase clients are built with `undefined!`). | `.env.example`; a Zod-validated `src/lib/env.ts` that throws at boot; move production secrets to Vercel/Doppler; delete the unused `DB_PASSWORD`. |
| **Legal / store** | **No native app exists** (no iOS/Android/Capacitor project, not even a PWA manifest). No privacy policy, ToS, consent flow, medical disclaimer, or **account deletion** — the last is an automatic rejection under Apple 5.1.1(v) and Play policy, and the app silently auto-creates accounts. | Decide the mobile approach first (Apple rejects thin web-view wrappers under 4.2). Then: privacy policy + ToS (AR/EN), consent capture persisted with version + timestamp, in-app account deletion + public deletion URL, data export, medical disclaimer. **BAAs with Supabase, Resend, and UltraMsg** — UltraMsg carries OTP codes and notifications over WhatsApp and is unlikely to sign one. |
| **Audit logging** | `ActivityLog` exists and is **written by nothing**. HIPAA §164.312(b) requires recording who accessed which PHI. After a breach there'd be no way to scope disclosure — the only honest answer would be "everything". | Write `ActivityLog` on every PHI read and write, from Step 1 onward. |

## Definition of done per step
Every step ships with: the "Check" line passing, a commit per logical change (conventional commits), no new `tsc`/lint errors, and the relevant audit doc updated if findings change.

## If you only do four things
1. **The 10-minute block at the top** — revoke the leaked token, patch the fail-open auth CVE, gitignore `.env`.
2. **Step 1** — the API is serving PHI to the public internet right now, and 3 of 9 roles can't even log in.
3. **Step 3's `serviceType` unification** — until one vocabulary exists, no pricing or commission code can match a single row, so every financial fix is blocked behind it.
4. **Step 8** — without toasts and error boundaries, every later fix succeeds or fails invisibly.

## Honest status summary

The repository is a **well-executed UI shell over a schema-only backend**. The visual layer is genuinely good — 55 pages, a coherent design system, a soundly mobile-first patient app, a clean TypeScript build with zero `any`. That work is real and worth keeping.

What's missing is the middle: there is **no domain layer**. The 68 API routes average 24 lines of unvalidated, unauthenticated Prisma pass-through. The three features the client named as most important — **محرك النسب (Commission Engine)**, **إدارة الأسعار (Pricing)**, and **المحافظ المالية (Wallets)** — are approximately **0%, 0%, and 5%** implemented, and the commissions page actively misrepresents this to anyone demoing it.

Treat the current build as a **high-fidelity prototype**, not a release candidate. Do not deploy to production or begin store submission until Step 1 is closed.

---

*Audit and plan only — no source files have been modified. Each step is independently committable and verifiable. Four audit passes; evidence in the four supporting documents.*
