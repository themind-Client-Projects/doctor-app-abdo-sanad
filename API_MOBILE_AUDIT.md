# API, Security, Schema & Mobile-Readiness Audit

> **2026-07-26** · Evidence document for `IMPLEMENTATION_PLAN.md`.
> Static read-only audit of all 68 `route.ts` files, `prisma/schema.prisma` (722 lines / 35 models), `src/lib/*`, `src/middleware.ts`, and the 26 patient pages. No endpoint was executed against a live server — attack chains are derived from code paths.

---

## 1. Verified headline facts

| Fact | Verified by |
|---|---|
| **0 of 68 API routes call `auth()`/`getServerSession`/`getToken`** | grep over `src/app/api/**/route.ts` |
| **`middleware.ts` matcher is `/dashboard`, `/admin`, `/operations` — `/api/*` is NOT matched** | `src/middleware.ts:43-49` |
| Only **1** route in the entire API returns 401 | `api/auth/otp/verify/route.ts:30` |
| **0** routes return 403 | no authz exists to produce it |
| **0** routes use Zod (it's a dependency; used in 1 frontend form) | grep |
| **31 of 45** mutating handlers pass raw `body` into Prisma | per-file read |
| **77 of 144** error returns are the identical string `"فشل"` | grep |
| Pagination: **5** routes (offset `page`/`pageSize`), none bounded | grep |
| **1** `@@index` in the entire schema (on `OTPCode`) | schema read |
| Money fields: **0** `Decimal`, **14** `Float` | schema read |
| `@updatedAt`: **15 of 35** models | schema read |
| FK-shaped `String` fields with no relation: **17** | schema read |
| **No `prisma/migrations/` directory** | `ls prisma/` → `schema.prisma`, `seed.ts` |
| **`prisma/` is untracked in git** | `git ls-files prisma/` → empty |
| **`.env` is not gitignored** (only `.env*.local` is) | `git check-ignore .env` → no match |
| No CORS, no `OPTIONS`, no versioning, no OpenAPI, no rate limiting, no health endpoint | grep |

---

## 2. Security — CRITICAL

### 2.1 The exposure

Every endpoint is callable anonymously from anywhere. Worst reachable actions:

| Endpoint | Anonymous capability |
|---|---|
| `GET/PUT /api/medical-records/[patientId]` | Read **or overwrite** any patient's history, chronic diseases, allergies, current medications, lab results, radiology, prior prescriptions. A forged allergy list or altered dosage is a **patient-safety** issue, not only privacy. |
| `POST /api/users` | `{"role":"SUPER_ADMIN","phone":"…"}` creates an admin. Then log in via OTP to that phone → genuine admin session. **Full compromise in two requests.** |
| `PATCH /api/users/[id]` | `{"role":"SUPER_ADMIN"}` escalates any account; changing `phone` hijacks an existing admin's OTP login path. |
| `POST /api/wallets/[partnerId]/transfers` | Creates a `Transaction` with attacker-chosen `amount`/`type`. The `{walletId, ...body}` spread puts `body` **last**, so a client-supplied `walletId` **overrides** the resolved wallet — money can be written to any wallet. |
| `PATCH /api/prescriptions/[id]` | Rewrites the `medications` JSON of any prescription. |
| `PATCH /api/lab-samples/[id]` · `radiology-requests/[id]` | Falsify diagnostic results / radiologist reports. |
| `GET /api/search?q=ال` | 2-character query sweeps orders (patient name + phone), users (name/email/phone/role), partners. A built-in enumeration oracle — cuid opacity is **not** a mitigation. |
| `GET /api/wallets` · `/api/commissions` | Every partner's balance and every partner's commercial terms, including the platform's own margin. |
| `POST /api/notifications/send` | Sends arbitrary email/WhatsApp from the platform's verified sender. `body` is interpolated **unescaped** into HTML (`resend.ts`) → phishing that passes SPF/DKIM/DMARC. |
| `DELETE /api/users/[id]` · `orders/[id]` · `partners/[id]` | Destroys records and cascades. |

### 2.2 OTP flow

The likely mobile login path, and currently the weakest component.

| Property | Finding |
|---|---|
| Rate limit (send) | **None.** Unlimited paid WhatsApp sends → billing abuse + harassment vector. |
| Rate limit (verify) | **None.** 10⁶ keyspace, unthrottled. |
| Entropy | `Math.random()` (`ultramessages.ts:100`) — **not a CSPRNG**. V8's xorshift128+ state is recoverable from observed outputs, making future codes **predictable**, not merely guessable. |
| Expiry | 5 minutes — **correctly implemented** ✅ |
| Single-use | **Broken.** `/verify` validates but never sets `verified` — the code replays for its full lifetime, and the endpoint is a free oracle for testing candidates. |
| Prior-code invalidation | **Absent.** N sends → N simultaneously valid codes. |
| Attempt counter / lockout | **Absent** — `OTPCode` has no `attempts` column, so it can't be implemented without a migration. |
| OTP in response/logs | **No** ✅ |
| Enumeration | Not leaked here ✅ — but `/api/search` and `/api/users` expose the phone directory anyway. |
| Returns a usable credential? | **No.** Returns `{success, verified}` only; the comment says the client must then call `signIn()`. **This is the mobile blocker.** |

**Chained attack:** read an admin's phone from `GET /api/users?role=SUPER_ADMIN` → spam `/otp/send` so thousands of codes are valid → spray `/otp/verify` (never consumes, never locks out) → replay the confirmed code through `signIn()` → 30-day admin session with no revocation. Every step unauthenticated and unthrottled.

### 2.3 `lib/auth.ts`

- Auto-provisions a `User` for **any** phone that passes OTP — login doubles as unauthenticated registration.
- **`User.isActive` is never checked** — deactivated users authenticate normally.
- `strategy: "jwt"` with no `maxAge` → NextAuth default **30 days**, with **no revocation mechanism** (the `Session` table is dead).
- The `jwt` callback only hits the DB at initial sign-in, so role changes and deactivation don't propagate for up to 30 days.
- `token.userId` is never set if the DB lookup fails → `session.user.id === undefined`. A future ownership check `record.patientId === session.user.id` then compares `undefined === undefined` → **`true`**. A latent auth bypass that will be introduced the moment ownership checks are written.
- `as unknown as Record<string, unknown>` casts instead of module augmentation — the same cast is already copy-pasted into `middleware.ts:33`.

### 2.4 Other

- **`.env` not gitignored** while holding `DATABASE_URL` (password inline), `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `ULTRAMSG_TOKEN`.
- `prisma.ts` logs full SQL **including bound parameters** in dev — PHI into terminal scrollback if ever pointed at production data.
- `supabase.ts` reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; **neither exists in `.env`** (which defines `…_PUBLISHABLE_KEY`). Clients are built with `undefined!`.
- `supabase-storage.ts` is imported by **nothing** — all findings latent, so this is the cheap moment to fix: caller-supplied unvalidated `path` (traversal), every helper uses the **service-role client** (bypasses all RLS), and `getFileUrl()` returns **permanent public URLs** for the `lab-results` / `radiology-images` buckets.
- **No audit logging.** `ActivityLog` is read by one route and **written by none** — after a breach there'd be no way to know which records were accessed.
- No security headers in `next.config.ts` (notably `Referrer-Policy` — patient IDs in URLs leak to third-party assets).

### 2.5 IDOR inventory (every `[id]` route has no ownership check)

`medical-records/[patientId]` · `prescriptions/[id]` · `lab-samples/[id]` · `radiology-requests/[id]` · `sanad-sessions/[id]` · `appointments/[id]` · `orders/[id]` (+ `/timeline`, `/accept`, `/assign`, `/reject`, `/hold`, `/transfer`) · `blood-bank/[id]` · `call-logs/[orderId]` · `users/[id]` · `partners/[id]` (+ `/contract`, `/performance`, `/schedule`, `/services`, `/wallet`) · `wallets/[partnerId]` (+ `/debts`, `/invoices`, `/transfers`) · `complexes/[id]` (+ all sub-routes) · `commissions/[id]` · `coupons/[id]` · `campaigns/[id]` · `pricing/[id]` · `notifications/[id]/read`

Plus query-param variants: `notifications?userId=`, `appointments?doctorId=`, and `dashboard/summary?role=&partnerId=` — **the client declares its own role**; this pattern must be deleted, not guarded.

---

## 3. API contract

### 3.1 Inconsistencies

- **Three success envelopes:** `{data}` (92 returns), `{data, total, page, pageSize, totalPages}` (5 routes, metadata as flat siblings not nested `meta`), `{message}` (all 10 DELETEs, no `data` key), `{success, …}` (2 OTP routes).
- **One error shape, no codes:** `{error: <Arabic string>}`. 77 are `"فشل"`. `{error:{code,message}}` appears zero times.
- **Status codes:** 400 used in only 4 places; 403/409/422/429 **never**; 500 is the catch-all (77+).
- **Same resource, different status per method:** `GET /api/orders/{bogus}` → 404, but `PATCH`/`DELETE` → **500** (uncaught Prisma `P2025`). True for every `[id]` route. Mobile retry logic keyed on 5xx retries forever.
- **`P2002` → 500 instead of 409** — reachable by exactly the duplicate `POST /api/orders/[id]/timeline` a mobile retry produces.
- **8 routes return 200 with `{"data": null}`** for a missing record.
- **42 of 44 `req.json()` calls are unguarded** → malformed body returns 500, not 400.

### 3.2 Mobile-hostile payloads

- `GET /api/orders` nests the full 11-row `timeline` for **every** row.
- `GET /api/complexes` — unbounded × unbounded × unbounded nesting.
- `GET /api/partners/[id]` — 8 relations including unbounded `debts` + `invoices`.
- 11 routes hard-cap at `take: 50/20/10` with **no way to fetch page 2** and no `hasMore`.
- 14 routes are fully unbounded.
- No field selection, no sparse fieldsets, no `updatedSince`, no date-range filters, no multi-value filters.

### 3.3 Data-shape bugs found while reading

- `dashboard/summary:93` emits `change: undefined` → `JSON.stringify` **drops the key**, and whether it exists depends on the data. Typed Swift/Kotlin decoders fail intermittently.
- `dashboard/summary:48` queries appointment statuses that the model never holds → `upcomingAppointments` is **always 0**. Same at `:164`/`:182` → `newPrescriptions` **always 0**.
- `partners/[id]/performance:12` — feedback query is **not scoped to the partner**; every partner sees the same global patient comments.
- `system-monitoring` — every value hardcoded; `serverSpeed` measures zero statements. **Reports a fabricated healthy system.**
- `dashboard/earnings` — TODO stub returning zeros.
- `dashboard/tasks:43` returns four different entity types under one key with **no discriminator**.
- `dashboard/alerts:19-23` — a query whose result is never used, run on every request.
- Currency appears only as a hardcoded display string; **no `currency` field on any money model**.
- `Appointment.date` (DateTime) + `time` (String `"09:00"`) are separate with no timezone; "today" is computed in server-local (UTC) time in 4+ routes → wrong for 3 hours daily in Iraq (UTC+3).

### 3.4 UI-shaped endpoints

`/api/dashboard/summary` returns per KPI: `label` (hardcoded Arabic), `color: "blue"` (Tailwind), `icon: "users"` (Lucide name), `href: "/dashboard/patients"` (Next.js route). `/api/search` returns `href: "/admin/partners/{id}"`. **These encode the web IA into the API** — a mobile app can't use any of it.

---

## 4. Data model

**Requirements coverage: 6 ✅ · 27 ⚠️ · 4 ❌.**

### Key gaps
- **`Order` has no monetary field** and **no lat/lng** — the requirement's "الموقع على الخريطة" is unimplementable, and the commission engine has no amount to split.
- **Commission Engine** — `CommissionRule` can express multi-party splits ✅, but shares are `Float` and `Contract.services`/`governorates`/`workHours`/`minPrices` are opaque `Json` (unqueryable, unvalidated, overlapping with `PriceConfig` with undefined precedence).
- **11-step timeline** — representable, but `step` is an unconstrained `Int` with free-text Arabic `title`; no canonical step enum; `OrderStatus` lacks `CONTACTED`, `RESULTS_UPLOADED`, `PATIENT_NOTIFIED`.
- **No attachment/file model** — lab results and radiology images are bare URL strings in `Json`, with no MIME type, size, uploader, checksum, or access audit.
- **`PatientMedicalRecord` has zero relations**, and 3 of its 8 fields are `Json` snapshots duplicating live tables → clinically unsafe drift.
- **`RadiologyEquipment` is fully orphaned** (no relations).
- `Coupon` has no redemption model, a race-prone counter, no per-user limit, and no link to `Order` (so no attribution).
- No `PHYSIO` role, though the app has a physiotherapy section.

### Multi-tenancy: none
`Order` has no owning `partnerId`; `LabSample.labId`, `RadiologyRequest.centerId`, `Prescription.pharmacyId` are **plain Strings with no FK**, so a client can write any value. `/api/wallets` and `/api/commissions` return every partner's data. Fix order: (1) authenticate + centralise scoping in a repository layer, (2) add tenancy columns and real FKs, (3) consider Postgres RLS as a backstop.

### Migrations: absent
Schema applied via `db push` — no history, silent dev/staging/prod drift, no rollback, no way to express the backfills this plan needs (`Float`→`Decimal`, etc.). `DIRECT_URL` exists in `.env` but isn't wired into `prisma.config.ts`; migrations through a pooler are unreliable.

---

## 5. Mobile parity

**Of ~40 patient capabilities: 3 usable as-is, ~14 partial, ~23 entirely missing.**

The entire patient catalog — specialties, doctors, labs, pharmacies, products, lab tests, surgeries, packages, offers, governorates — exists **only** in `src/lib/constants/demo-data.ts` and `specializations.ts`. There is no `Specialty` model, no `Product` model, no patient `Wallet` (it's `partnerId @unique`), no `Address` model, no favourites, and no referral-entitlement model despite referral-gated pricing being a core rule across four pages.

Patient-scoped filters are missing where the models exist: `/api/appointments` filters `doctorId` only; `/api/orders` has no `patientId`; `/api/prescriptions` has no filter at all; `/api/radiology-requests` has none; **`LabSample` has no `patientId` field**.

### Infrastructure
| Capability | Status |
|---|---|
| Push notifications | ❌ No `PUSH` channel, no `DeviceToken` model, no FCM/APNs. Only email + WhatsApp. |
| File upload/download | ❌ `supabase-storage.ts` imported by nothing; no upload route; `getFileUrl()` returns public URLs. |
| Realtime | ❌ No WS/SSE. Recommendation: push-as-wake-up + REST refetch; SSE only for the live tracking screen. `OrderTimeline` has **no `createdAt`**, so `?since=` isn't yet implementable. |
| Offline/sync | ❌ 19 models lack `updatedAt`; zero `deletedAt`; offset pagination; no `ETag`/`Cache-Control`; no `Idempotency-Key`. |
| Geolocation | ❌ `Governorate` model has no route; **no lat/lng anywhere**; addresses are free text. |
| Payments | ❌ No gateway. "Wayl" is a `setTimeout` in `cart-drawer.tsx`. All money is `Float`. |
| Version gating / health | ❌ Neither exists. Build both **before** the first store submission. |
| Localization | ❌ **67 of 68 route files contain Arabic literals.** Arabic leaks into *data* (`OrderTimeline.title`, and `serviceType` Arabic strings used as `@@unique` business keys). Mobile can never re-localize. |

### Architecture recommendation
Build **`/api/v1/*` inside this Next.js app** on a shared `src/server/services` layer — not a separate BFF (which would need its own deploy, Prisma pool, and auth verification for no isolation benefit at this team size), and not direct mobile consumption of the current routes (unauthenticated, UI-shaped, and missing the patient surface entirely). Keep the legacy routes serving the web app; converge them onto the same services later.

---

## 6. Top 12 fixes (this audit)

| # | Fix | Sev |
|---|---|---|
| 1 | Authenticate all 68 routes + ownership checks + CI guard | 🔴 |
| 2 | Kill the privilege-escalation chain (`POST /api/users`, `PATCH /api/users/[id]` accepting `role`, auto-provisioning, unchecked `isActive`) | 🔴 |
| 3 | Zod-validate all 45 mutating handlers; eliminate mass assignment; clamp `pageSize` | 🔴 |
| 4 | Harden OTP (CSPRNG, rate limits, atomic single-use, attempt cap, delete the `/verify` oracle) | 🔴 |
| 5 | `.env` → `.gitignore`; `git add prisma/`; rotate credentials if ever public | 🔴 |
| 6 | Baseline migrations; `Float` → `Decimal` + `currency`; add the ~60 missing indexes | 🟠 |
| 7 | Response envelope + error-code catalog; map `P2025`→404, `P2002`→409, `ZodError`→400 | 🟠 |
| 8 | Cursor pagination API-wide, `limit` ≤ 100 | 🟠 |
| 9 | Bearer/refresh token layer with rotation + reuse detection; set NextAuth `maxAge` | 🟠 |
| 10 | `/api/v1` + service layer + generated OpenAPI + patient-scoped `/me/*` endpoints | 🟠 |
| 11 | Push + media (private buckets, signed URLs) + geo + `app/config` + `health` | 🟡 |
| 12 | Rate limiting, security headers, `ActivityLog` writes on PHI access, timezone fixes | 🟡 |

---

*Static audit. No files modified. Recommend validating the two-request `SUPER_ADMIN` chain against a local instance to determine whether this is a hardening exercise or a breach-response situation.*
