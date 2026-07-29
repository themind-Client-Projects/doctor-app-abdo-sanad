# Final Sweep Audit — Everything the First Three Passes Missed

> **2026-07-26** · Fourth and final audit pass. Evidence for `IMPLEMENTATION_PLAN.md`.
> Covers: dependency CVEs, routing integrity, auth UX, role coverage, business-logic correctness, RTL/i18n/a11y/responsive, build & bundle, observability, testing, deployment, legal/app-store.

**This pass found more than the previous three combined.** Three findings are more urgent than anything reported earlier.

---

## 🚨 Act today

### 1. A live GitHub token is sitting in plaintext in the project root
`token.md` contains a **GitHub Personal Access Token (`ghp_…`) embedded in a `git push` URL** for `github.com/testIQProjects/doctor-app-abdo-sanad`.

It **is** gitignored and `git log --all -- token.md` confirms it was never committed — so it hasn't leaked through git. But it's an unencrypted, long-lived, push-scoped credential readable by any process, backup, IDE sync, or screen-share.

**→ Revoke it now** at github.com/settings/tokens, delete the file, and use `gh auth login` or a credential helper instead.

### 2. `.env` is not gitignored
`.gitignore:26` is `.env*.local` — which matches `.env.local` but **not** `.env`. The file holds the live `DATABASE_URL` (password inline), `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, and `ULTRAMSG_TOKEN`. It is untracked today only because nobody has run `git add -A`.

### 3. Your auth library has a CVE that matches your middleware code exactly
`next-auth@5.0.0-beta.31` → **GHSA-8fpg-xm3f-6cx3: existence-based auth checks fail open.** On a config error, the `auth` object is populated with an *error object* instead of being null.

`src/middleware.ts:26` is `if (!session?.user) { redirect to /login }` — precisely the vulnerable pattern. If Auth.js enters a config-error state (missing `AUTH_SECRET`, bad Google creds), `req.auth` becomes truthy → **the guard passes → `/admin`, `/operations`, `/dashboard` open to anonymous users.** Middleware is the *only* authorization layer for those routes.

Plus three more `@auth/core` criticals/highs, and **`next@16.2.6` carries 9 advisories** including a *middleware bypass on Turbopack + single-locale apps* — this app is built with Turbopack and is single-locale (`lang="ar"`).

**Both fixes are patch-level and safe:** `next-auth` → `beta.32`, `next` → `16.2.12`. Plain `npm audit fix` resolves them (do **not** use `--force` — it would downgrade `shadcn` by a major).

> A Vercel automated CVE-patch branch — `origin/vercel/react-server-components-cve-vu-ipq78s` — **already exists in the remote and was never merged.**

```bash
cd "/Users/ahmed/Desktop/doctor app" && printf '\n.env\n' >> .gitignore && rm token.md && npm audit fix && git add prisma/ .gitignore
```

---

## 4. Routing integrity — ~55 broken internal links

### 3 of 9 roles cannot complete a login

`login/page.tsx:61,72` hardcodes `router.push("/dashboard")` for **everyone**. There is no per-role landing map.

| Role | What happens on successful login |
|---|---|
| **PATIENT** — the schema default for *every* new user (`schema.prisma:173`, `auth.ts:62`) | → `/dashboard` → middleware: PATIENT is **absent from `roleRoutes`** → `/unauthorized` → **404** |
| **SUPER_ADMIN** | → `/dashboard` → not in dashboard roles → `/unauthorized` → **404. Admin cannot reach `/admin` by logging in.** |
| **OPERATIONS** | → `/dashboard` → **404. Ops cannot reach `/operations`.** |
| DOCTOR/LAB/PHARMACY/NURSE/DRIVER/RADIOLOGY | ✅ land correctly (on partly-broken navigation) |

**`/unauthorized` does not exist** — no file resolves it, and there's no `not-found.tsx`, so users get Next's bare unstyled LTR 404 inside an RTL Arabic app.

### Dead navigation

| Source | Broken |
|---|---|
| `dashboard-sidebar.tsx` | **24 of 35 links are 404.** Every role's المالية / الإشعارات / الإعدادات trio is dead (`/dashboard/finance`, `/notifications`, `/settings` ×6 each) |
| `quick-actions.tsx` | **13 of 13 are 404 — 100% failure** |
| `api/dashboard/summary` KPI hrefs | 9 × 404 |
| `dashboard-header.tsx` | `/dashboard/profile`, `/dashboard/settings` → 404 |
| RADIOLOGY role | **1 working link total.** Sidebar → `/dashboard/requests` (404); the real page `/dashboard/imaging` is **orphaned with 0 inbound links** |
| Also missing | `/admin/partners/new`, `/operations/orders/[id]` |
| Dead controls | 4 × `href="#"` in `complexes/[id]`, 6 no-op profile menu rows, 2 empty `href="tel:"`, placeholder `wa.me/1234567890` |
| Orphan routes | `/search` (313 lines), `/services/packages`, `/dashboard/imaging` — 0 inbound links each |
| Dead endpoints | `/api/search` (never fetched), `/api/auth/otp/verify` (never called by the client) |

### Logout does not exist

`signOut` is exported at `auth.ts:7` and **never imported anywhere**. Three logout buttons — `dashboard-header.tsx:130`, `dashboard-sidebar.tsx:157`, `profile/page.tsx:98` — all have no handler. **There is no way to log out of this application.**

### Login page bugs

- **`login/page.tsx:53-62` — a failed OTP can redirect as success.** With `redirect:false`, next-auth v5 returns `{error: undefined, url: null}` on failure; the code checks `result?.error`, so an invalid code falls into the `else` branch and pushes to `/dashboard`. The correct guard is `!result?.ok || result.url === null`.
- **No resend cooldown, no attempt cap, no rate limit.** Every tap of "إعادة الإرسال" (`:233`) inserts an `OTPCode` row and bills a WhatsApp message. `OTPCode` has no `attempts` column → **unlimited brute-force on 6 digits inside the 5-minute window.**
- **`callbackUrl` is written but never read.** `middleware.ts:28` sets it; `login/page.tsx` never calls `useSearchParams()`. All deep links dump the user on `/dashboard`.
- **No phone normalization** — `07XX` vs `+9647XX` vs spaces create *different* DB rows, so requesting with one format and verifying with another silently fails.
- **OTP inputs are inaccessible:** no labels, **no `autoComplete="one-time-code"` (iOS/Android SMS autofill is dead)**, no paste handler (pasting fills only box 1), no arrow keys, errors have no `role="alert"`.
- `User.isActive` is never enforced; an expired session **silently degrades to `PATIENT`** (`use-role.ts:9`) instead of redirecting.
- Missing entirely: register, forgot/change phone, session-expiry handling, **account deletion** (App Store 5.1.1(v) blocker).

### Structure

- **`BottomNavbar` is mounted in the root layout** (`app/layout.tsx:29`) → the patient bottom nav renders on `/login`, every `/dashboard/*`, `/admin/*`, and `/operations/*`, with a global `pb-16`. A doctor sees a patient nav bar; an admin can tap "سند".
- `/` is a hardcoded patient landing with no session check — a logged-in SUPER_ADMIN visiting `/` sees a fake patient dashboard.
- `(admin)` and `(operations)` layouts have **no header at all** — no user identity, no notifications, no logout.
- `middleware.ts:18-20` uses bare `startsWith` → `/dashboardfoo` matches `/dashboard`.
- 8 KPI cards pass `?status=` to pages that never read `searchParams`.

---

## 5. Business logic — the platform cannot transact

### The Commission Engine does not exist

The client calls it *"أهم جزء في وريد"*. Reality:

- **No code anywhere computes a split.** Grep for `waridShare|partnerShare|complexShare|nurseShare|driverShare|calculateCommission` returns 13 matches — all type declarations and CRUD pass-throughs, **zero arithmetic**.
- **The admin page is a mock.** `admin/commissions/page.tsx:16-52` — percentages are a hardcoded module constant in `useState`. It never calls `/api/commissions`. "إضافة قاعدة" has no `onClick`. Edits vanish on navigation.
- **It renders a banner at `:70-73` claiming *"جميع النسب مرتبطة بالعقود — لا توجد نسب ثابتة في النظام (سطر 230 من المتطلبات)"*** — "no hardcoded percentages in the system" — **20 lines below the hardcoded percentages.** This will not survive client review.
- **`Order` has no monetary field at all** (`schema:361-399`). No `totalAmount`, no `price`, no `currency`. **There is nothing to split.**
- **Warid has nowhere to bank its own share** — `Wallet.partnerId` is required and unique, and Warid is not a Partner.
- Shares are **not validated to sum to 100%** (the only validator runs client-side on throwaway state). Rules are mutable in place with no effective-dating, so historical orders would re-split at today's rates.

### Five incompatible `serviceType` vocabularies

`Order` uses `HOME_VISIT`/`ONLINE`/`X_RAY`… · `CommissionRule` uses `استشارة حضورية`/`تحليل منزلي` · `PriceConfig` uses `استشارة حضورية`/`فحص CBC` · `ServiceConfig` uses `حضوري`/`أونلاين` · `Contract.services` uses `حضوري`/`CBC`.

**Even if the pricing and commission engines were written today, they would match zero rows for every order in the database.** The join key is broken at the data-model level. This must be fixed *first* — every other financial fix depends on it.

### Money & ledger

- **No code ever writes a wallet balance.** The only `Transaction` writer (`wallets/[partnerId]/transfers/route.ts:8`) doesn't update the wallet. Seeded balances have zero backing entries — `balance ≠ Σ transactions` from day one.
- **No double-entry.** `Transaction` has one `walletId` and a free-text `type`. A credit has no matching debit; the books cannot balance.
- **`grep '$transaction' src/` → NONE.** Nothing in the app is transactional.
- No idempotency → the unauthenticated transfers endpoint **credits twice if called twice**.
- `PaymentStatus.REFUNDED` is never set by any code path.
- `Invoice.orderId` has **no relation declared** — not even referential integrity.
- **`ActivityLog` is never written by any route** — financial changes leave no trace.

### Order lifecycle — no state machine

- **Multi-party dispatch is impossible.** `assign` always writes `step: 3`, and `@@unique([orderId, step])` rejects the 2nd call — so the requirement's own lab + nurse + driver example **cannot be dispatched**. The 2nd and 3rd assignment 500 and roll back.
- **8 of the 11 required timeline steps have no writer.** No endpoint ever reaches `COMPLETED` — so an order can never be legitimately completed, which is exactly the trigger settlement would need.
- `PATCH /api/orders/[id]` spreads the raw body → set `COMPLETED`, flip `paymentStatus: PAID`, rewrite `patientId`, in one unauthenticated call.
- `assign` never validates the partner — **a DRIVER id passed as `type:"lab"` is written to `assignedLabId`**.
- Accept-twice hard-fails (P2002 → 500) and rolls back the status change.
- `hold` overloads `DELAYED` — the same status the alerts feed uses for "late". No un-hold endpoint exists.
- **The tracking page can never load:** it sends `status=IN_PROGRESS,ASSIGNED,…` as one comma string into a Prisma enum filter → 500. The 11-step UI is permanently empty.

### Other domain gaps

- **Zero double-booking prevention.** `appointments/route.ts:34-42` is `create({data: body})` — no schedule check, no overlap check, no capacity check, no past-date check, and **`Appointment.price` is client-supplied** (free consultations by request). Overlap is undefinable anyway: `time` is a free string with no duration.
- **Coupons never redeem.** No redeem endpoint, `usedCount` never incremented, no `CouponRedemption` table (so per-user limits are impossible), `expiresAt`/`isActive` never checked. The admin pricing UI reads three field names that don't exist → renders *"خصم undefined%"*.
- **`ServiceConfig.dailyCapacity` and `.status` are never consulted** — suspended partners keep receiving work.
- **`PatientFeedback` has no create endpoint** — feedback can never be submitted, so `Partner.rating` (seed-only) can never be computed. Reports rank "أفضل الأطباء" by static demo numbers.
- **Dispatch has no algorithm** and no lat/lng exists, so "بعده عن المريض" is unimplementable.

### Seed (`prisma/seed.ts`, 484 lines)

- **Not idempotent** — 8 models use bare `create` → **37 duplicate rows per re-run**. All upserts use `update: {}`, so re-running never corrects drift.
- **12 models unseeded**, and they map 1:1 to the empty dashboards: `OrderTimeline` (tracking panel), `Transaction` (**every earnings KPI returns 0**), `EmployeeStatus` (dispatch columns), `PatientFeedback`, `CallLog`, `PatientMedicalRecord`, `Invoice`, `Debt`.
- **Double-encoded JSON** — `Contract.services` etc. are `JSON.stringify`'d into `Json` columns, storing a *string* not an array. Any `.map()` consumer throws.
- **Creates a `SUPER_ADMIN` (`admin@warid.app`) with no `NODE_ENV` guard** and prints the roster to stdout. Whoever controls that Google address inherits admin.
- **`doctorId` ↔ `partnerId` ID-space mismatch** (`summary/route.ts:34,41,49`): `Appointment.doctorId` references `DoctorProfile.id` but a `Partner.id` is passed → **all doctor KPIs are permanently 0**.
- **LAB and RADIOLOGY KPIs never filter by `partnerId`** → every lab sees every other lab's counts. Cross-tenant leak.
- No `prisma.seed` entry in `package.json` and `tsx` isn't a dependency — the documented command won't run on a clean checkout.

---

## 6. RTL / i18n / accessibility / responsive

### Rule 6 compliance: non-compliant, but less severe than the ratio suggests

~40 logical vs ~280 physical property usages (12.5%). **But ~250 of the 280 render correctly today** — in a fixed-RTL document `pr-*` ≡ `ps-*` and `text-right` ≡ `text-start`. Only **8 sites are visibly wrong now**:

- `login/page.tsx:189` — `ArrowLeft` beside the label **`رجوع`** (in RTL, back points right). Every other back button in the app uses `ArrowRight`.
- `services/taxi/page.tsx:338,342` — `text-left` on Arabic text, visibly misaligned.
- `ui/drawer.tsx:76` — `md:text-left` affects **every drawer in the app**.
- `ui/dialog.tsx:68` — close button at `right-2`; in RTL it belongs top-left.
- `doctors-directory/page.tsx:456` — **`dir-ltr` is not a Tailwind class**, it's a silent no-op, so the phone number renders RTL and mis-orders.
- Notification badge sits on opposite corners in different portals.

**Good news:** `space-x-*`, `divide-x`, and `flex-row-reverse` = **0 occurrences**; all `translate-x` are symmetric. The flex/spacing category has no RTL bugs. A correct logical-property cluster already exists (`search-input.tsx`, `forms/input.tsx`, `flexible-header.tsx`, newer `(sanad)` pages) — this is a migration, not a redesign.

### Localization: zero infrastructure

**2,034 Arabic string literals across 157 files.** No i18n library, no message catalog. Worst: `demo-data.ts` (224), `bookings/page.tsx` (73), `taxi/page.tsx` (60).

- **Currency is wrong in the admin panel.** `ر.ي` = **Yemeni Rial** appears 11× in `admin/page.tsx`, `admin/wallets`, `admin/partners/[id]`, `kpi-cards.tsx` — while the patient app uses `د.ع` (Iraqi Dinar) 54× and `packages/page.tsx:84` uses a third unit, `ريال`. **The admin dashboard reports the same wallet balances in a different currency than the patient app.**
- **`ar-EG` vs `ar-IQ` produce different month names** — يوليو (admin/ops) vs تموز (patient booking). Verified empirically. For an Iraqi product `ar-IQ` is correct.
- `homecare-reservation-form.tsx:209` calls `.toLocaleString()` with **no locale** → Latin digits next to `د.ع` on a non-Arabic browser.
- 19 sites hardcode Arabic-Indic numerals (`٤:٠٠ م`, `'٤.٨'`) — permanently unformattable.
- `ui/dialog.tsx:75` announces English "Close" to Arabic screen-reader users.

**Cost to add English/LTR: ~5–6 weeks**, ~85% of it string extraction. The styling half is ~2 days.

### Accessibility

- **47 form controls, only 2 `htmlFor` and 9 `aria-label`.** The 16 visible `<label>`s aren't programmatically associated. ~14 search boxes rely on `placeholder` alone.
- **~15 icon-only buttons with no accessible name**; 2 drawers with no `DrawerTitle`; a clickable `<tr>` that is keyboard-unreachable.
- 4 `role="button"` divs handle **Enter only** — WCAG requires Space.
- **`services/surgeries:79` is `text-xs text-gray-300` at 1.47:1 contrast** — the worst defect. `text-gray-400` (2.54:1, fails AA) on 80 sites.
- No skip-link. 14 components start at `<h3>` with no h1/h2.
- **Good:** all images have `alt`; all modals use `vaul`/`base-ui` so focus trap, `aria-modal`, and Escape come free. No hand-rolled modals.

### Responsive — admin/ops/dashboard are unusable on a phone

- **`grep 'md:hidden'` returns zero hits app-wide.** The 256px sidebars in `(operations)/layout.tsx:40`, `(admin)/layout.tsx:38`, `dashboard-sidebar.tsx:86` are `fixed … w-64` and **never hide**. At 360px the sidebar covers **71% of the viewport** and `mr-64` leaves a **104px content column**.
- **18 of 20 tables cannot scroll horizontally.** Most sit in `overflow-hidden` wrappers, which **clips** 6–8 column tables with no scroll affordance — silently hiding data.
- **Sidebar collapse desyncs from content offset** — `isCollapsed` is local to the sidebar while the layout hardcodes `mr-64`, leaving a 188px dead gap. A real bug at any screen size.
- Tap targets of 32px on primary back/close controls; `100vh` with no `dvh` fallback.
- **The patient app itself is soundly mobile-first** — `max-w-md`, snap carousels, `env(safe-area-inset-*)`.

---

## 7. Production readiness

### Build: ✅ succeeds — but every route is oversized

`npx next build` → **exit 0**, 6.5s, TypeScript clean, 82 static pages. One warning: *"The `middleware` file convention is deprecated — use `proxy`"*. Given middleware is the only authz layer, a silent break there is a fail-open.

**Shared baseline: ~612 kB raw / ~182 kB gzip on every route** — including the 404 page. Heaviest: `/bookings` 872 kB, `/nursing` 851 kB, `/` 794 kB. `recharts`, `react-day-picker`, and `zustand` are not code-split. For patients on mobile networks, ~200 kB gzip before any content is a serious problem.

**The static/dynamic split is inverted.** `/dashboard/patients`, `/dashboard/prescriptions`, `/admin/users`, `/wallet`, `/profile`, `/notifications` are all **prerendered static** — which is only "viable" because they fetch everything client-side from unauthenticated APIs. They should all be dynamic and session-gated.

### Observability: none

No Sentry, no structured logging, no request IDs, no health endpoint, no uptime monitoring, no analytics, no rate limiting.

- **82 `catch (error)` blocks bind the error and never reference it.**
- **77 endpoints return the bare string `"فشل"`** as their entire error payload.
- **28 `console.*` calls total across 68 routes.**

The medical-records endpoint's entire error path is `catch { return json({error:"فشل"}, 500) }` — **the stack trace is destroyed inside the catch.** Production incidents are undebuggable.

### Testing: zero

No framework, no test files. **Recommendation: Vitest** (native ESM/TS, no Babel pipeline, Jest-compatible `expect`). Highest-leverage first artifact: a **table-driven test over all 68 routes asserting 401 when unauthenticated** — one file, fails 68 times today, each fix flips one green. Then the middleware authz matrix (including a case where `req.auth` is a truthy error object, covering the fail-open CVE). Target: **100% of API routes have an authorization test**; ~70% line coverage on `src/lib` and `src/app/api`; 0% on pages is fine.

### Deployment & data safety

No `.github/`, no `vercel.json`, no `.vercel`. `package.json` has no `test`, `migrate`, or `deploy` script. **`git push` to `main` is the deploy pipeline** — no lint gate, no build gate, no review, no staging.

- **No migrations.** 35 models applied via `db push`, which treats a rename as *drop + add* → **silent irreversible PHI loss**. No history, no rollback, no audit trail.
- **`DIRECT_URL` is defined but never wired into `prisma.config.ts`** — DDL would run through the transaction pooler, which can fail midway leaving a partially-applied schema.
- **No backup story.** No scripts, no runbook, no evidence PITR is enabled, no restore ever tested, no off-provider copy. Supabase Free has no backups; Pro is daily snapshots with no PITR unless enabled.

### Config

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read by code but not defined** — `.env` defines `…_PUBLISHABLE_KEY`. All three Supabase clients are built with `undefined!`. Currently dead code, but it's the entire PHI file-upload subsystem awaiting activation.
- Unused: `DB_PASSWORD` (a raw password read by nothing), `NEXT_PUBLIC_APP_URL`, `DIRECT_URL`.
- **No `.env.example`.** `.env` and `.env.local` are byte-identical duplicates and **both load at build time**.
- **Good:** no true secret is exposed via `NEXT_PUBLIC_`.

### Legal / app-store: cannot be submitted

**There is no native app at all** — no `ios/`, `android/`, Capacitor, or Expo config, and not even a PWA manifest. Also note Apple rejects thin web-view wrappers under Guideline 4.2.

Absent: privacy policy, terms of service, consent flow, **in-app account deletion** (automatic rejection under Apple 5.1.1(v) and Play policy — and the app silently auto-creates accounts), data export, medical disclaimer.

Beyond store review — regulatory, not cosmetic: unauthenticated PHI endpoints are a reportable breach under GDPR/PDPL; HIPAA §164.312(b) requires audit logging (there is none); no consent capture exists in any of the 35 models; **UltraMsg carries OTP codes and notifications over WhatsApp** and is unlikely to sign a BAA.

---

## Consolidated new top 15

| # | Sev | Finding |
|---|---|---|
| 1 | 🔴 | Live GitHub PAT in plaintext at `token.md` — revoke now |
| 2 | 🔴 | `next-auth` CVE **fails open** on exactly the pattern at `middleware.ts:26`; `next` has a Turbopack middleware-bypass advisory. Both patch-level fixes |
| 3 | 🔴 | `.env` not gitignored while holding live secrets |
| 4 | 🔴 | **Commission Engine doesn't exist** — hardcoded React state under a banner claiming the opposite |
| 5 | 🔴 | **5 incompatible `serviceType` vocabularies** — any pricing/commission engine matches zero rows |
| 6 | 🔴 | `Order` has no monetary field; no code writes a wallet balance; no `$transaction` anywhere |
| 7 | 🔴 | **3 of 9 roles (incl. the default PATIENT) cannot log in** — `/unauthorized` doesn't exist |
| 8 | 🔴 | **Logout does not exist** — `signOut` never imported; 3 dead buttons |
| 9 | 🔴 | Failed OTP can redirect as success (`login/page.tsx:53`); no rate limit, no attempt cap |
| 10 | 🔴 | Multi-party dispatch impossible (`assign` always `step:3`); 8 of 11 timeline steps have no writer |
| 11 | 🟠 | 24/35 sidebar + 13/13 quick-action links are 404; RADIOLOGY has 1 working link |
| 12 | 🟠 | Admin/ops/dashboard unusable on phones; 18/20 tables clip instead of scroll |
| 13 | 🟠 | Zero observability — 82 swallowed errors, 77 × `"فشل"`, no Sentry/health/request-IDs |
| 14 | 🟠 | Zero tests, zero CI; `git push` is the deploy pipeline; no migrations, no backups |
| 15 | 🟠 | No legal surface, no account deletion, **no native app exists**; admin shows Yemeni Rial for Iraqi Dinar balances |

---

*Static audit — no source files modified. The GitHub token value is deliberately not reproduced in this document.*
