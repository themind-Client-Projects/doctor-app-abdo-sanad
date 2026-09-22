# وريد / Warid — HTTP API

Reference for building a native client against this backend.

Written for the mobile developer taking this over. It documents what the code
does today, not what is planned; where something is missing or unfinished it
says so under [Not ready yet](#not-ready-yet) rather than being left out.

The endpoint table at the bottom is generated from the route files:

```bash
node scripts/api-inventory.mjs --markdown
```

Regenerate it after adding a route. A hand-kept list is wrong the day after it
is written, and a client has no way to tell.

---

## Contents

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Patient app surface](#patient-app-surface)
- [Provider app surface](#provider-app-surface)
- [Import it into Postman (or anything else)](#import-it-into-postman-or-anything-else)
- [Error codes](#error-codes)
- [Not ready yet](#not-ready-yet)
- [Full endpoint index](#full-endpoint-index)

---

## Conventions

### Base URL

`https://<host>/api`. Everything below is relative to it.

### Response envelope

Success, single resource:

```json
{ "data": { "id": "cms2x8...", "name": "…" }, "meta": { "requestId": "…" } }
```

Success, collection:

```json
{
  "data": [ … ],
  "meta": { "requestId": "…", "page": { "nextCursor": "eyJ…", "hasMore": true, "limit": 20 } }
}
```

Failure — **any** non-2xx:

```json
{ "error": "الطلب غير موجود", "code": "NOT_FOUND", "requestId": "…" }
```

Branch on `code`, never on `error`. `error` is human-readable Arabic intended
for logs and for display when you have no better string; it is not stable and
will change wording. `code` is the contract.

Validation failures add a `details` array:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": [{ "field": "phone", "code": "too_small", "message": "رقم الهاتف مطلوب" }]
}
```

`field` is a dot path into the body you sent, so it maps directly onto a form
field. `(root)` means the body itself was wrong (malformed JSON, or a
cross-field rule).

### Request id

Send `X-Request-Id: <uuid>` on every request. It comes back in `meta.requestId`
(or `requestId` on errors) and appears in the server log line for that request.
When reporting a bug, quote it — it is the only way to find the exact request.

### Money

`Decimal(18,3)` in the database, serialised as a **JSON number**, not a string.
Every money field on every endpoint is a number — if you ever see a quoted
numeral, report it as a bug.

Currency is Iraqi dinar throughout. Most endpoints omit it entirely because
there is only one; where a field does appear it is **not consistent**:
`GET /api/dashboard/earnings` returns the display string `"د.ع"`, while stored
settlement rows carry the ISO code `"IQD"`. Do not branch on either — assume
IQD and format it yourself.

Do not do money arithmetic in floating point on values you intend to write back.
Read them, display them, and let the server compute totals — pricing, coupons,
commission and wallet settlement are all decided server-side.

### Dates

ISO 8601 UTC strings (`2026-08-08T09:30:00.000Z`).

Business days are **Asia/Baghdad (UTC+3, no DST)**. "Today's earnings" and
similar are bucketed by Baghdad day on the server. If you bucket dates yourself,
use the same offset or your totals will disagree with the server's by up to
three hours' worth of records.

### Numbers and locale

The UI locale is `ar-IQ-u-nu-latn` — Arabic, with **Latin** digits (`1234`, not
`١٢٣٤`). Phone numbers, ids, money and dates render left-to-right inside an
otherwise RTL layout. Match this or numbers will read inconsistently against the
web app.

### Pagination

Two styles. Prefer keyset.

**Keyset (preferred).** Pass `?limit=20`, then `?limit=20&cursor=<meta.page.nextCursor>`.
Stop when `hasMore` is false. The cursor is an opaque base64url value over
`(createdAt, id)` — do not parse or construct it.

```
GET /api/v1/me/orders?limit=20
GET /api/v1/me/orders?limit=20&cursor=MjAyNi0wOC0wOFQwOTozMDowMC4wMDBafGNtczJ4OA
```

**Offset (legacy).** Some older list endpoints also accept `?page=1&pageSize=20`
and add flat `total` / `page` / `pageSize` keys alongside `data`. It exists for
the web dashboard. Do not build on it: every list is ordered `createdAt desc`,
so a row inserted between page 1 and page 2 shifts everything down and the
client silently sees a duplicate and misses a record.

**The two styles handle an out-of-range page size differently**, which is worth
knowing before you debug it:

- `?limit=1000` → **400 `VALIDATION_FAILED`**. The maximum is **100 on every
  list**, and asking for more is refused. (Several endpoints used to cap at 50,
  60 or 200 with nothing saying so; they are all 100 now, so one number is
  enough to build against.)
- `?pageSize=1000` → **200, silently serving 20**. The legacy parameter falls
  back to its default instead of rejecting.

Another reason to use `limit`: it tells you when you got it wrong.

### Empty filter values

Query filters treat `""` as "not set". `?status=` is the same as omitting it.
An *invalid* value is a 400, not an empty result — `?status=nonsense` returns
`VALIDATION_FAILED` so a typo in a client build fails loudly instead of showing
the user an empty screen. This holds for enum-valued filters too: `?box=typo` on
`/api/referrals` is a 400, not a silent fallback to "all".

### Unknown fields are rejected

Write bodies are strict. An unexpected key is a **400**, not a silently ignored
field. This is deliberate: the bodies used to be spread straight into the ORM,
so any column was writable. If you get a 400 naming a key you sent, remove it —
do not assume the server will ignore it.

---

## Authentication

Two independent mechanisms. A native client uses **bearer tokens**.

| | Bearer token | Cookie session |
| --- | --- | --- |
| For | mobile, any non-browser client | the web app |
| Header | `Authorization: Bearer <accessToken>` | NextAuth cookie |
| Obtained from | `POST /api/auth/token` | `/api/auth/*` (browser redirect flow) |

**If an `Authorization` header is present, its verdict is final.** The server
never falls through to the cookie. An expired or tampered bearer is a 401 even
if a valid cookie is also attached. Send the header or don't; never both.

### Token lifetimes

| | Lifetime | Notes |
| --- | --- | --- |
| Access token | **15 minutes** | JWT, `iss: warid`, `aud: warid-mobile` |
| Refresh token | **60 days** | opaque random string, stored hashed |

The access token carries authorisation context only — `sub`, `role`,
`partnerId`, `doctorProfileId`. **No name, phone, email or clinical data**: a JWT
is signed, not encrypted, so anyone holding it can read the payload. Do not
decode it for display data; call `/api/v1/me`.

### `POST /api/auth/token` — sign in

Public. Three grants.

**Staff — email and password**

```json
{ "grantType": "password", "email": "staff@warid.app", "password": "…" }
```

Throttled per email and per IP. Too many failures returns `429 RATE_LIMITED`;
back off and show the message rather than retrying.

**Patients — phone OTP**

First `POST /api/auth/otp/send { "phone": "07701234567" }`, then:

```json
{ "grantType": "otp", "phone": "07701234567", "code": "123456" }
```

- Phone numbers are normalised server-side; `07701234567`, `+9647701234567` and
  `9647701234567` are the same account.
- The code is 6 digits, single-use, and consumed atomically — a code never works
  twice, including on a retry after a dropped response.
- 5 wrong guesses per code, **3 codes per hour per phone**. Worth knowing while
  developing: a sign-in screen tested repeatedly against one number hits this
  in minutes and starts answering `429 RATE_LIMITED`, which reads like a broken
  endpoint. Rotate test numbers, or wait out the hour. The limit is per phone,
  not per device.
- **Creates the account** if the number is new, as a `PATIENT`.
- **PATIENT only.** Staff have phone numbers too; without this restriction a
  known admin's number plus one code would mint an admin token.

**Patients — Google**

```json
{ "grantType": "google", "idToken": "eyJhbGciOiJSUzI1NiIs…" }
```

Send the **ID token** from the native Google SDK, not an access token. An access
token only identifies the app holding it; the ID token is a signed statement
about who signed in, which is what the server verifies.

The server checks the signature against Google's JWKS, that `iss` is Google,
that `exp` has not passed (60s clock tolerance), that `email_verified` is true,
and that **`aud` is one of this deployment's own client ids**.

> **Setup required.** A phone's Google SDK mints a token whose `aud` is that
> platform's own client id — the iOS one or the Android one — not the web client
> id. Both must be listed in `GOOGLE_MOBILE_CLIENT_IDS` (comma separated) or
> every real device is rejected with 401. See `.env.example`.
>
> If no Google client id is configured at all, the grant answers **422
> `BUSINESS_RULE_VIOLATION`** rather than pretending the token was bad.

Behaviour, matching the web sign-in exactly:

1. Google account already linked → signs that user in.
2. Not linked, but the email already belongs to a user → **refused (401)**.
   Linking is a deliberate act by the account holder, not a side effect of
   signing in. Without this, a Google token for a staff member's predictable
   address would inherit their role.
3. Neither → creates a `PATIENT`, links the account, marks the email verified.

PATIENT only, for the same reason OTP is.

**Response** — identical for all three grants:

```json
{
  "data": {
    "accessToken": "eyJ…",
    "refreshToken": "8Kj…",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": { "id": "cms2x8…", "role": "PATIENT", "name": "أحمد" }
  }
}
```

**Failures** are a single generic `401 UNAUTHENTICATED` with the message
`بيانات الدخول غير صحيحة`, whatever went wrong. Do not try to tell "no such
account" from "wrong password" — the server deliberately does not say, so the
endpoint cannot be used to discover which emails and numbers exist.

### `POST /api/auth/token/refresh`

Public.

```json
{ "refreshToken": "8Kj…" }
```

Returns a **new pair** — the refresh token rotates. Replace both; the old
refresh token is dead.

**Reuse is treated as a compromise.** Presenting a refresh token that was
already consumed revokes the entire token family and forces a real sign-in: the
legitimate client and an attacker cannot both legitimately hold it. Two
practical consequences:

- Never refresh concurrently from two places in the app. Serialise it behind a
  single in-flight promise, or a race will log the user out.
- If the response is lost in flight, do **not** retry with the same token. Sign
  in again.

A 401 here means the session is genuinely over.

### `POST /api/auth/token/logout`

Requires a bearer token.

```json
{ "refreshToken": "8Kj…" }   // this device
{ "allDevices": true }        // everything
```

Revokes refresh tokens. The current **access token stays valid until it
expires** — up to 15 more minutes. It cannot be revoked; that is what its short
lifetime is for. Discard it client-side on sign-out.

### Roles

`SUPER_ADMIN`, `OPERATIONS`, `DOCTOR`, `LAB`, `PHARMACY`, `NURSE`, `DRIVER`,
`RADIOLOGY`, `PATIENT`.

Role groups used in the endpoint index:

| Group | Members |
| --- | --- |
| `ROLES.ADMIN` | `SUPER_ADMIN` |
| `ROLES.OPERATIONS` | `SUPER_ADMIN`, `OPERATIONS` |
| `ROLES.STAFF` | everyone except `PATIENT` |
| `ROLES.CLINICAL` | staff who may read clinical records (all but `DRIVER`) |
| `AUTHENTICATED` | any signed-in user, including patients |
| `PUBLIC` | no authentication |

Partner-scoped endpoints additionally narrow to the caller's own records — a lab
sees its own samples, never another lab's. Scoping is applied **after** any
client-supplied filter, so `?partnerId=` can only narrow within your own slice,
never widen past it. A signed-in role with no partner record matches nothing
rather than everything.

---

## Patient app surface

Everything a patient client needs. `AUTHENTICATED` unless marked public.

### Identity and profile

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/me` | user, wallet balance, profile stats. **Works signed-out**, returning `{ user: null, wallet: null }` — the app is browsable anonymously, so this is a normal state, not an error. |
| `PATCH /api/v1/me/profile` | name, governorate, area |
| `GET /api/v1/me/notifications` | in-app notifications |

### Browsing — public, no token

| Endpoint | Purpose |
| --- | --- |
| `GET /api/public/storefront` | home screen: categories, featured providers |
| `GET /api/public/doctors` | doctor list, filterable |
| `GET /api/public/doctors/[id]` | one doctor, with per-channel pricing |
| `GET /api/public/partners` | labs, pharmacies, radiology centres |
| `GET /api/public/offers` | active offers |
| `GET /api/public/governorates` | governorate list |
| `GET /api/public/feature-flags` | which features this build should show |

**Channels.** A provider can sell through more than one storefront, at different
prices: `DIRECT` (public), `SANAD` (the Sanad membership), `COMPLEX` (inside a
medical complex). Prices differ per channel. Pass the channel the user is
actually browsing when booking, or they are charged the wrong price.

Read `GET /api/public/feature-flags` at startup and honour it. It is how
features are turned off in production without shipping a build.

### Booking

**`POST /api/v1/me/bookings`**

```json
{
  "serviceType": "IN_PERSON_CONSULT",
  "providerId": "cms2x8r76…",
  "source": "DIRECT",
  "governorateId": "cms2x8a…",
  "area": "الكرادة",
  "address": "شارع 62، قرب جامع الرحمن",
  "notes": "…",
  "couponCode": "WELCOME10",
  "payFromWallet": false
}
```

- `serviceType` — one of: `IN_PERSON_CONSULT`, `ONLINE_CONSULT`, `HOME_VISIT`,
  `HOME_BLOOD_DRAW`, `HOME_LAB_TEST`, `LAB_TEST`, `RADIOLOGY`,
  `PHARMACY_DISPENSE`, `MEDICINE_DELIVERY`, `NURSING`, `PHYSIOTHERAPY`,
  `SURGERY`, `BLOOD_BANK`, `TAXI`.
- `source` — the storefront, and therefore the price. Defaults to `DIRECT`.
- **The patient is taken from the token**, never from the body. There is no
  `patientId` field; sending one is a 400.
- **Price is computed server-side.** You cannot send an amount. The server
  validates that the provider actually serves this service type on this channel
  and has a live contract; a booking that would land on a provider who cannot
  serve it is refused (422) rather than discovered later by dispatch.
- `payFromWallet` is a request, not an instruction. It is honoured only when the
  `booking.electronic_deduction` flag is on and the balance covers the total.
  Check the response for what actually happened.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/me/bookings` | the bookings **screen** — see below. Not a plain list. |
| `POST /api/v1/me/bookings/[id]/cancel` | cancel |
| `GET /api/v1/me/orders` | orders only |
| `GET /api/v1/me/orders/[id]/timeline` | status history for a tracking screen |
| `GET /api/v1/me/appointments` | appointments only |

**`GET /api/v1/me/bookings` is screen-shaped, not list-shaped.** It is the one
endpoint here that does not return `data: [...]` with `meta.page`, so
`data.map(...)` against it yields nothing:

```json
{
  "data": {
    "upcoming": [ { "id": "…", "kind": "appointment" | "order", "status": "…", … } ],
    "past":     [ … ],
    "truncated": false,
    "limit": 50
  }
}
```

It merges appointments and orders into cards for the bookings screen, splits
them by upcoming and past, and carries at most `limit` of each source.
`truncated` is true when there was more — send the user to `/api/v1/me/orders`
and `/api/v1/me/appointments`, which are keyset-paginated, rather than
presenting a partial history as the whole of it.

### Wallet

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/me/wallet` | balance and transactions |
| `GET /api/v1/me/wallet/topup` | available top-up methods |
| `POST /api/v1/me/wallet/topup` | start a top-up |

Top-up settles through the Wayl payment provider, confirmed by a
server-to-server webhook (`POST /api/webhooks/wayl`). **Do not credit the
balance client-side on a successful-looking return from the payment sheet** —
poll `GET /api/v1/me/wallet` until the balance changes. The webhook is the only
thing that moves money.

### Reference data

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/specialties` | medical specialties |
| `GET /api/v1/doctors` | authenticated doctor list |

### Verifying a printed document

```
GET /api/public/documents/verify?reference=RAD-2024-05120&code=<code>
```

Public, no token. Every referral document carries a QR whose URL is
`/verify/{reference}?c={code}`; scanning it opens a web page, and this endpoint
is the same check for an app that would rather verify in-app than open a browser.

```json
{ "data": {
    "referenceNumber": "RAD-2024-05120",
    "kind": "RADIOLOGY",
    "status": "completed",
    "issuedAt": "2024-05-20T10:30:00.000Z",
    "expiresAt": "2024-06-19T10:30:00.000Z",
    "isExpired": false,
    "respondedAt": "2024-05-21T08:00:00.000Z",
    "fromPartner": "عيادة د. أحمد",
    "toPartner": "مركز الرافدين للأشعة",
    "complex": "مجمّع بغداد الطبي" } }
```

**No patient data comes back** — no name, no phone, no clinical content, no
result, no attachments. Whoever scanned the QR is already holding the document;
this confirms what they can see rather than disclosing what they cannot. Do not
build a screen that expects more.

**Every failure is the same `404`** with code `NOT_FOUND` — unknown reference,
wrong code, malformed input. They are deliberately indistinguishable: the
sequence is an incrementing integer, so a distinguishable answer would enumerate
the platform's referral volume. Treat 404 as "not verified", never as "retry".

A `200` is not the whole answer. Check `status` and `isExpired` too: a genuine
document that was withdrawn returns `status: "cancelled"`, and one past its
30-day window returns `isExpired: true`. Both are real documents that must not
be acted on.

---

## Provider app surface

For a staff/partner client. All `ROLES.STAFF` unless noted, and all scoped to
the caller's own partner record.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/partners/me` | the caller's own provider record — read-only |
| `GET /api/dashboard/summary` | headline counts |
| `GET /api/dashboard/earnings` | wallet balance, today, this month, and the gross value of delivered-but-unsettled work |
| `GET /api/dashboard/patients` | people this provider has treated, derived from their own orders, appointments, referrals and prescriptions |
| `GET /api/dashboard/tasks` · `alerts` · `calendar` · `recent-activity` | worklist widgets |
| `GET /api/orders` | orders assigned to this partner |
| `GET /api/transactions` | this partner's wallet ledger |
| `GET /api/notifications` | notifications |
| `GET /api/lab-samples` · `PATCH /api/lab-samples/[id]` | lab worklist |
| `GET /api/radiology-requests` · `PATCH .../[id]` | radiology worklist |
| `GET /api/prescriptions` · `POST` · `PATCH` | prescriptions — see below |

**`Prescription.medications` is a structured table, not free JSON.** Each row
requires `name`, `form`, `dose`, `route` and `duration`; `notes` is optional.
`form` uses the same vocabulary as a `PHARMACY` referral. It previously accepted
any array of objects, so a prescription with no dose reached a pharmacy that
then had to telephone the doctor — sending the old loose shape is now a **400**
naming the missing column.

A prescription is **valid for 30 days** (`expiresAt`). Marking one `delivered`
after that is refused with 422.

Dispensing records who and when: send `pharmacistName` with
`{"status": "delivered"}` from the **pharmacy** — a doctor sending it gets 403,
and `dispensedAt` / `dispensedById` are stamped server-side from the status
change, never accepted from the client.

`GET /api/dashboard/earnings` returns figures from the wallet ledger, which is
the only record that decides what a partner is owed. `upcoming` is the **gross**
value of completed, priced, unsettled orders — not a payout figure, because the
partner's share depends on the commission rule that will apply.

### Referrals inside a medical complex

A provider inside a complex hands a patient's case to a colleague in the same
complex, and they reply with a result. The complex is resolved from the token —
there is no complex id to pass, and a provider in no complex gets **422**.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/referrals/recipients` | who I may refer to. Returns `{ complex: null, recipients: [] }` outside a complex, so the screen can explain rather than fail. |
| `GET /api/referrals?box=inbox\|outbox\|all` | referrals I am party to. Every row carries `direction: "incoming" \| "outgoing"`. |
| `POST /api/referrals` | send one — see the four kinds below |
| `GET /api/referrals/[id]` | one referral, with its full document |
| `PATCH /api/referrals/[id]` | reply, or withdraw |

#### Four documents, not one

`kind` selects which form is being sent, and decides both **who may receive it**
and **which `clinical` fields are required**. Sending the wrong shape is a 400
with the offending field named; sending it to the wrong kind of provider is 422.

| `kind` | Document | Number | Goes to |
| --- | --- | --- | --- |
| `DOCTOR` *(default)* | إحالة حالة مريض — the general case | `REF-2026-00007` | any member |
| `RADIOLOGY` | طلب أشعة | `RAD-2026-00007` | a radiology centre |
| `PHARMACY` | وصفة طبية | `RX-2026-00007` | a pharmacy |
| `LAB` | طلب تحاليل | `LAB-2026-00007` | a lab |

**Request:**

```json
{
  "kind": "RADIOLOGY",
  "toPartnerId": "cms2x8…",
  "patientId": "cms2x8…",
  "title": "مقطعية على الدماغ",
  "description": "صداع مستمر منذ شهر",
  "priority": "NORMAL" | "URGENT" | "CRITICAL",
  "clinical": { … }
}
```

**Response** adds four computed fields to the stored row:

| Field | Meaning |
| --- | --- |
| `referenceNumber` | the number printed on the paper — `RAD-2026-00007` |
| `isExpired` | true once `expiresAt` has passed |
| `expiresAt` | issue + **30 days** |
| `events[]` | the track: `{ status, at, byUserId, note }`, oldest first |

#### `clinical`, per kind

**`RADIOLOGY`** — the three safety answers are **required booleans**, not
optional flags. An imaging centre needs a stated `false`; an absent field means
"nobody asked", and for a metal implant next to an MRI scanner those are not the
same fact. Omitting any of them is a 400.

```json
{
  "examTypes": ["CT:brain", "XRAY:chest"],
  "contrastAllergy": false,
  "possiblePregnancy": false,
  "metalImplant": false,
  "otherSafetyNotes": "…",
  "radiologistNotes": "…",
  "patientInstructions": "الصيام 6 ساعات"
}
```

`examTypes` is a closed vocabulary — free text cannot be scheduled onto a machine
or priced. Valid codes:

`XRAY:chest` · `XRAY:bone` · `XRAY:opg` · `XRAY:other`
`ULTRASOUND:abdomen_pelvis` · `ULTRASOUND:thyroid` · `ULTRASOUND:breast` · `ULTRASOUND:doppler` · `ULTRASOUND:other`
`CT:brain` · `CT:chest` · `CT:abdomen` · `CT:pelvis` · `CT:other`
`PET_CT:pet_ct` · `PET_CT:other`

**`PHARMACY`** — every column of the printed table is required except `notes`.

```json
{
  "medications": [
    {
      "name": "Augmentin 1g / أوجمنتين 1 جم",
      "form": "tablet",
      "dose": "1 قرص",
      "route": "كل 12 ساعة",
      "duration": "7 أيام",
      "notes": "بعد الأكل"
    }
  ],
  "doctorNotes": "…"
}
```

`form` ∈ `tablet` · `capsule` · `syrup` · `injection` · `inhaler` · `drops` ·
`cream` · `suppository` · `other`. Max 30 drugs, at least 1.

**`LAB`**

```json
{ "tests": ["CBC — تحليل دم شامل"], "fastingRequired": true, "clinicalNotes": "…" }
```

**`DOCTOR`** — everything optional; it is the general case.

```json
{
  "referralType": "إحالة تخصص",
  "vitals": { "bloodPressure": "130/85", "pulse": 96, "temperature": 37.2 },
  "summary": ["خفقان عند الجهد", "تخطيط قلب أولي غير طبيعي"],
  "allergies": "لا توجد"
}
```

> `clinical` is a different shape per `kind`. In a statically-typed client model
> it as a sealed union discriminated on `kind`, not as one struct with every
> field optional — the server rejects unknown keys, so a merged struct will send
> fields that fail validation.

#### Replying

Statuses: `sent` → `received` → `in_progress` → `completed`, or `cancelled`.

- Only the **recipient** moves it forward, and only forward.
- Only the **sender** cancels, and only while `sent` or `received` — once work
  has started, "cancelled" would be a false record of what happened.
- `completed` requires a `resultSummary`; closing it empty is a 400.
- `completed` and `cancelled` are terminal. Nothing reopens them.
- Only the recipient may write `resultSummary` / `attachments` (403 otherwise).
- **An expired document is refused with 422** for every change except
  `cancelled` — withdrawing it is housekeeping and stays allowed. Check
  `isExpired` before offering the action.
- Every accepted status change appends to `events[]`, so the printed track is a
  record rather than a guess from the current status.
- Attachments are `{ url, name }`, max 10. `url` must be an internal path or an
  `https://` URL — `javascript:`, `data:` and protocol-relative URLs are
  rejected. There is no upload endpoint yet; see [Not ready yet](#not-ready-yet).

A referral is visible only to its two parties. Anything else is a **404**, not a
403, so the endpoint cannot be used to discover which referral ids exist.

A referral may only name a patient the sender genuinely holds — through an
order, an appointment, **or a referral they are party to**. That last one is what
lets the chain continue: doctor → lab → pharmacy.

---

## Import it into Postman (or anything else)

**OpenAPI 3.1**, generated from this codebase. Postman, Insomnia, Swagger UI
and Bruno all import it directly, and `openapi-generator` will turn it into a
typed Swift or Kotlin client.

```bash
npx tsx scripts/generate-openapi.ts
```

That writes **two** files, and which one you hand over matters:

| File | Contents | Give it to |
|---|---|---|
| `openapi.mobile.json` | 24 paths, 26 operations — `Auth` + `Public` + `Patient` | **the mobile team** |
| `openapi.json` | 123 paths, 193 operations — everything | web dashboard work |

The native app signs in as a `PATIENT` and holds no other role, so the other
167 operations would answer **403** to it. Handing over the full spec makes the
client's first job guessing which endpoints apply — and a guess that lands on a
provider route costs a round of "why is this 403" before anyone suspects the
document. The filtered spec answers the question by construction.

`PATCH /api/notifications/{id}/read` is in the mobile spec even though it sits
outside `/api/v1`: the notifications screen cannot work without it, so it is
part of the patient surface and carries the same stability promise.

Run the generator after changing any route. Two halves of the spec are derived,
not written: the paths, methods and required role come from walking
`src/app/api`, and the **request bodies come from the Zod schemas the routes
validate with**. So the spec cannot describe a field the server would reject, or
omit one it requires — the radiology safety booleans and the medication columns
appear as `required` because they genuinely are.

### Postman

1. **Import** → `docs/api/openapi.mobile.json` → it becomes a collection with
   folders per tag (Auth, Public, Patient).
2. **Import** → `docs/api/warid.postman_environment.json`, then select it.
3. Set `baseUrl` in the environment.
4. Open the **collection** → **Authorization**. The spec declares a bearer
   scheme, so Postman preselects **Bearer Token** — but it fills a placeholder
   of its own, not our variable. Replace the token value with
   `{{accessToken}}`. Every request inherits it; leave each request's own auth
   on *Inherit from parent*.
5. Sign in and capture the token. On `POST /api/auth/token`, add this to the
   **Scripts → Post-response** tab so you never paste a token by hand:

```js
const b = pm.response.json();
if (b?.data?.accessToken) {
  pm.environment.set("accessToken", b.data.accessToken);
  pm.environment.set("refreshToken", b.data.refreshToken);
}
```

   Add the same to `POST /api/auth/token/refresh` — it rotates both, and the old
   refresh token dies immediately.

To sign in as a patient locally: `POST /api/auth/otp/send` with `{{phone}}`,
read the code from the **server console** (no SMS provider is configured — see
[Not ready yet](#not-ready-yet)), then `POST /api/auth/token` with
`grantType: "otp"`.

### Generating a typed client

```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.mobile.json -g swift5 -o ./client-swift
```

One caveat the generator cannot infer: **`clinical` on a referral is a union
discriminated by `kind`**, and every variant is `.strict()`. Model it as a sealed
type — `RadiologyClinical`, `PharmacyClinical`, `LabClinical`, `DoctorClinical`
are all published as separate components for exactly this. A single struct with
every field optional will send keys that the server rejects with a 400.

### What the spec does not carry

It describes shapes, not behaviour. These live in this document and nowhere else:

- refresh-token rotation, and that **reusing one kills the whole family**
- Baghdad-day bucketing on anything labelled "today"
- money as a JSON number, and never doing arithmetic on it client-side
- the 30-day validity on referrals and prescriptions, and the 422 it causes
- `404` also meaning "not yours"
- which endpoints are for mobile at all — everything tagged `Internal` serves
  the web dashboards and is unversioned

Read this file first; use the spec to save typing.

---

## Error codes

| Code | Status | Meaning | What the client should do |
| --- | --- | --- | --- |
| `MALFORMED_JSON` | 400 | body was not valid JSON | bug — fix the request |
| `VALIDATION_FAILED` | 400 | see `details[]` | show field errors |
| `INVALID_QUERY_PARAM` | 400 | bad query string | bug |
| `UNAUTHENTICATED` | 401 | missing, expired or invalid credentials | refresh once, then sign in |
| `FORBIDDEN` | 403 | authenticated, but not allowed | do not retry; hide the action |
| `NOT_FOUND` | 404 | no such resource, **or not yours** | treat as gone |
| `DUPLICATE_RESOURCE` | 409 | already exists | show the conflict |
| `INVALID_REFERENCE` | 409 | points at something that does not exist | bug |
| `INVALID_STATE_TRANSITION` | 409 | not legal from the current state | refetch; your state is stale |
| `BUSINESS_RULE_VIOLATION` | 422 | valid request, refused by a domain rule | show `error` — it explains why |
| `RATE_LIMITED` | 429 | too many attempts | back off; do not retry immediately |
| `INTERNAL_ERROR` | 500 | server fault | retry with backoff; report `requestId` |
| `UPSTREAM_UNAVAILABLE` | 502/503 | a third party failed | retry with backoff |

**On 401**, attempt exactly one refresh, then sign in. Never loop.

**404 also means "not yours."** Several endpoints answer 404 rather than 403 for
a resource that exists but belongs to someone else, so that ids cannot be probed
for existence. Do not interpret 404 as "this definitely does not exist."

---

## Not ready yet

Honest gaps. None of these are hidden behind a stub that appears to work.

**File upload.** There is no upload endpoint. `SUPABASE_SERVICE_ROLE_KEY` is not
configured, so the storage client cannot write to a bucket. Anything taking a
file — referral attachments, lab results, avatars — accepts a URL you host
elsewhere. When the key is configured, an upload endpoint can return a URL into
the same field and no stored data changes.

This does not affect the patient app, which uploads nothing: the fields that
carry files belong to the provider surface, and the app only ever reads the
URLs a provider already stored.

**Notifications are in-app, by design.** `GET /api/v1/me/notifications` is an
activity feed the user opens and reads, with `PATCH /api/notifications/{id}/read`
marking one seen. There is no device-token registration and no APNs/FCM
delivery, and none is planned — so a booking confirmation reaches the user when
they next open the app, not before. Poll the feed; do not build against a push
that will not arrive.

**OTP delivery.** Wired to UltraMsg/WhatsApp, but no credentials are set in this
environment, so no message is sent. The verification half is complete.

`POST /api/auth/otp/send` tells you which it was:

```json
{ "data": { "sent": true,  "delivery": "sent" } }
{ "data": { "sent": false, "delivery": "not_configured",
            "message": "لا مزوّد رسائل مهيّأ — الرمز مطبوع في سجل الخادم" } }
```

**Developing against a local server:** with no provider, the code is printed to
the server console (`[otp] WhatsApp not configured — code for … is 123456`).
Read it from there to complete sign-in. It is never in the response body, and
never will be — that would make sign-in an open door the moment the same build
reached production, where this case answers **502** instead.

To exercise the real delivery path, set `ULTRAMSG_INSTANCE_ID` and
`ULTRAMSG_TOKEN`. Leaving the example file's `your-instance-id` in place counts
as unconfigured, deliberately: a placeholder that looked like a credential used
to defeat this fallback and made sign-in fail with a 502 on every dev machine.

**`/api/v1` vs the rest.** `/api/v1/*` is the patient surface and is versioned.
Everything else is the internal surface the web dashboards use — it is stable
enough to build against but is not versioned, and a provider client should
expect it to change with the web app.

**Error envelope.** Flat everywhere — `{ error, code, requestId }` — including
under `/api/v1`. An earlier draft of this document claimed `/api/v1` nested its
errors as `{ error: { code, message } }`; it does not, and a client written
against that claim would read `body.error.code` as `undefined` and mis-handle
every failure. One shape, on every route.

**Appointment status vocabulary.** `Appointment.status` is free-text, with
`scheduled` / `completed` / `cancelled` in active use. It is not an enum and is
not validated as strictly as order status. Do not rely on an exhaustive list.

---

## Full endpoint index

Generated by `node scripts/api-inventory.mjs --markdown`. The role beside each
method is the group that may call it.

<!-- BEGIN GENERATED: api-inventory -->

| Endpoint | Methods |
| --- | --- |
| `/api/activity-logs` | `GET` ROLES.ADMIN |
| `/api/appointments/[id]` | `GET` APPOINTMENT_ROLES<br>`PATCH` APPOINTMENT_ROLES<br>`DELETE` APPOINTMENT_ROLES |
| `/api/appointments` | `GET` APPOINTMENT_ROLES<br>`POST` APPOINTMENT_ROLES |
| `/api/appointments/today` | `GET` ROLES.CLINICAL |
| `/api/auth/otp/send` | `POST` PUBLIC |
| `/api/auth/token/logout` | `POST` AUTHENTICATED |
| `/api/auth/token/refresh` | `POST` PUBLIC |
| `/api/auth/token` | `POST` PUBLIC |
| `/api/banners/[id]` | `GET` ROLES.ADMIN<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/banners` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/blood-bank/[id]` | `GET` ROLES.OPERATIONS<br>`PATCH` ROLES.OPERATIONS<br>`DELETE` ROLES.OPERATIONS |
| `/api/blood-bank` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS |
| `/api/call-logs/[orderId]` | `GET` ROLES.OPERATIONS |
| `/api/call-logs` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS |
| `/api/campaigns/[id]` | `PUT` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/campaigns` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/commissions/[id]` | `PUT` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/commissions/by-contract/[contractId]` | `GET` ROLES.ADMIN |
| `/api/commissions/preview` | `POST` ROLES.ADMIN |
| `/api/commissions` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/complexes/[id]/departments` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/complexes/[id]/doctors` | `GET` ROLES.OPERATIONS |
| `/api/complexes/[id]/members` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/complexes/[id]/revenue` | `GET` ROLES.ADMIN |
| `/api/complexes/[id]` | `GET` ROLES.OPERATIONS<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/complexes/[id]/stats` | `GET` ROLES.ADMIN |
| `/api/complexes` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN |
| `/api/coupons/[id]` | `GET` ROLES.ADMIN<br>`PUT` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/coupons` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/dashboard/admin-overview` | `GET` ROLES.OPERATIONS |
| `/api/dashboard/alerts` | `GET` ROLES.STAFF |
| `/api/dashboard/calendar` | `GET` ROLES.STAFF |
| `/api/dashboard/earnings` | `GET` ROLES.STAFF |
| `/api/dashboard/patients` | `GET` ROLES.CLINICAL |
| `/api/dashboard/recent-activity` | `GET` ROLES.STAFF |
| `/api/dashboard/summary` | `GET` ROLES.STAFF |
| `/api/dashboard/tasks` | `GET` ROLES.STAFF |
| `/api/feature-flags/[key]` | `PATCH` ROLES.ADMIN |
| `/api/feature-flags` | `GET` ROLES.ADMIN |
| `/api/feedback` | `GET` ROLES.OPERATIONS |
| `/api/governorates/[id]` | `GET` ROLES.STAFF<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/governorates` | `GET` ROLES.STAFF<br>`POST` ROLES.ADMIN |
| `/api/invoices/[id]` | `GET` ROLES.OPERATIONS<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/invoices` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN |
| `/api/lab-samples/[id]` | `GET` ROLES.CLINICAL<br>`PATCH` ROLES.CLINICAL |
| `/api/lab-samples` | `GET` ROLES.CLINICAL<br>`POST` ROLES.CLINICAL |
| `/api/medical-records/[patientId]` | `GET` AUTHENTICATED<br>`PUT` RECORD_WRITE_ROLES |
| `/api/memberships/[id]/terminate` | `POST` ROLES.ADMIN |
| `/api/memberships` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/notifications/[id]/read` | `PATCH` AUTHENTICATED |
| `/api/notifications` | `GET` AUTHENTICATED |
| `/api/notifications/send` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/accept` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/advance` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS |
| `/api/orders/[id]/assign` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/complete` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/contacts` | `GET` ROLES.OPERATIONS |
| `/api/orders/[id]/hold` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/price` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]/reject` | `POST` ROLES.OPERATIONS |
| `/api/orders/[id]` | `GET` ROLES.STAFF<br>`PATCH` ROLES.OPERATIONS<br>`DELETE` ROLES.ADMIN |
| `/api/orders/[id]/settle` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS<br>`DELETE` ROLES.ADMIN |
| `/api/orders/[id]/timeline` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS |
| `/api/orders/[id]/transfer` | `POST` ROLES.OPERATIONS |
| `/api/orders` | `GET` ROLES.STAFF<br>`POST` ROLES.OPERATIONS |
| `/api/partners/[id]/contract` | `GET` ROLES.ADMIN<br>`PUT` ROLES.ADMIN |
| `/api/partners/[id]/performance` | `GET` ROLES.OPERATIONS |
| `/api/partners/[id]` | `GET` ROLES.OPERATIONS<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/partners/[id]/schedule` | `GET` ROLES.ADMIN<br>`PUT` ROLES.ADMIN |
| `/api/partners/[id]/services` | `GET` ROLES.ADMIN<br>`PUT` ROLES.ADMIN |
| `/api/partners/[id]/wallet` | `GET` ROLES.ADMIN |
| `/api/partners/me` | `GET` ROLES.STAFF |
| `/api/partners/onboard` | `POST` ROLES.ADMIN |
| `/api/partners` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN |
| `/api/patients/[id]/wallet` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN |
| `/api/plans/[id]` | `GET` ROLES.ADMIN<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/plans` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/prescriptions/[id]` | `GET` PRESCRIPTION_ROLES<br>`PATCH` PRESCRIPTION_ROLES |
| `/api/prescriptions` | `GET` PRESCRIPTION_ROLES<br>`POST` PRESCRIPTION_ROLES |
| `/api/pricing/[id]` | `PUT` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/pricing` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/public/doctors/[id]` | `GET` PUBLIC |
| `/api/public/doctors` | `GET` PUBLIC |
| `/api/public/documents/verify` | `GET` PUBLIC |
| `/api/public/feature-flags` | `GET` PUBLIC |
| `/api/public/governorates` | `GET` PUBLIC |
| `/api/public/offers` | `GET` PUBLIC |
| `/api/public/partners` | `GET` PUBLIC |
| `/api/public/storefront` | `GET` PUBLIC |
| `/api/radiology-requests/[id]` | `GET` RADIOLOGY_ROLES<br>`PATCH` RADIOLOGY_ROLES |
| `/api/radiology-requests` | `GET` RADIOLOGY_ROLES<br>`POST` RADIOLOGY_ROLES |
| `/api/referrals/[id]` | `GET` ROLES.STAFF<br>`PATCH` ROLES.CLINICAL |
| `/api/referrals/recipients` | `GET` ROLES.STAFF |
| `/api/referrals` | `GET` ROLES.STAFF<br>`POST` ROLES.CLINICAL |
| `/api/reports` | `GET` ROLES.ADMIN |
| `/api/sanad-sessions/[id]` | `PATCH` ROLES.OPERATIONS |
| `/api/sanad-sessions` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.OPERATIONS |
| `/api/search` | `GET` ROLES.OPERATIONS |
| `/api/services/[id]` | `GET` ROLES.OPERATIONS<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/services` | `GET` ROLES.OPERATIONS<br>`POST` ROLES.ADMIN |
| `/api/specialties/[id]` | `GET` ROLES.ADMIN<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/specialties` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/system-monitoring` | `GET` ROLES.ADMIN |
| `/api/transactions` | `GET` ROLES.STAFF |
| `/api/users/[id]/password` | `POST` ROLES.ADMIN |
| `/api/users/[id]/role` | `PUT` ROLES.ADMIN |
| `/api/users/[id]` | `GET` ROLES.ADMIN<br>`PATCH` ROLES.ADMIN<br>`DELETE` ROLES.ADMIN |
| `/api/users` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/users/staff` | `GET` ROLES.OPERATIONS |
| `/api/v1/doctors` | `GET` AUTHENTICATED |
| `/api/v1/me/appointments` | `GET` AUTHENTICATED |
| `/api/v1/me/bookings/[id]/cancel` | `POST` AUTHENTICATED |
| `/api/v1/me/bookings` | `GET` AUTHENTICATED<br>`POST` AUTHENTICATED |
| `/api/v1/me/membership` | `GET` AUTHENTICATED<br>`POST` AUTHENTICATED |
| `/api/v1/me/notifications` | `GET` AUTHENTICATED |
| `/api/v1/me/orders/[id]/feedback` | `GET` AUTHENTICATED<br>`POST` AUTHENTICATED |
| `/api/v1/me/orders/[id]/timeline` | `GET` AUTHENTICATED |
| `/api/v1/me/orders` | `GET` AUTHENTICATED |
| `/api/v1/me/profile` | `PATCH` AUTHENTICATED |
| `/api/v1/me` | `GET` PUBLIC |
| `/api/v1/me/wallet` | `GET` AUTHENTICATED |
| `/api/v1/me/wallet/topup` | `GET` AUTHENTICATED<br>`POST` AUTHENTICATED |
| `/api/v1/specialties` | `GET` AUTHENTICATED |
| `/api/wallets/[partnerId]/debts/[debtId]` | `PATCH` ROLES.ADMIN |
| `/api/wallets/[partnerId]/debts` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/wallets/[partnerId]/invoices` | `GET` ROLES.ADMIN |
| `/api/wallets/[partnerId]` | `GET` ROLES.ADMIN |
| `/api/wallets/[partnerId]/transfers` | `GET` ROLES.ADMIN<br>`POST` ROLES.ADMIN |
| `/api/wallets` | `GET` ROLES.ADMIN |
| `/api/webhooks/wayl` | `POST` PUBLIC |
