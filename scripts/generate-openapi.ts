#!/usr/bin/env tsx
/**
 * Build `docs/api/openapi.json` from the code that actually serves the API.
 *
 *   npx tsx scripts/generate-openapi.ts
 *
 * Two halves, neither hand-maintained:
 *
 *   - **Paths, methods and auth** come from walking `src/app/api`, the same way
 *     `api-inventory.mjs` builds the endpoint table.
 *   - **Request bodies** come from the Zod schemas the routes validate with,
 *     converted by `z.toJSONSchema`. The spec therefore describes the shape the
 *     server genuinely accepts; it cannot document a field that would be
 *     rejected, or miss one that is required.
 *
 * That second half is the whole point. A hand-written spec is wrong within a
 * week and the client has no way to tell — the same failure this project already
 * hit twice with a hand-kept endpoint list and a hand-written error-shape claim.
 *
 * Import it into Postman, Insomnia, Swagger UI, or feed it to
 * openapi-generator to produce a typed Swift/Kotlin client.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

import { tokenGrantSchema } from "@/app/api/auth/token/route";
import { refreshBodySchema } from "@/app/api/auth/token/refresh/route";
import { otpSendSchema } from "@/app/api/auth/otp/send/route";
import { createReferralSchema } from "@/app/api/referrals/route";
import { respondReferralSchema } from "@/app/api/referrals/[id]/route";
import { createBookingSchema } from "@/app/api/v1/me/bookings/route";
import { updateProfileSchema } from "@/app/api/v1/me/profile/route";
import { createPrescriptionSchema } from "@/app/api/prescriptions/route";
import { verifyDocumentQuerySchema } from "@/app/api/public/documents/verify/route";
import { purchaseMembershipSchema } from "@/app/api/v1/me/membership/route";
import {
  doctorClinicalSchema,
  labClinicalSchema,
  medicationSchema,
  pharmacyClinicalSchema,
  radiologyClinicalSchema,
} from "@/server/services/referral-forms";

/* ------------------------------ route walking ----------------------------- */

const API_DIR = "src/app/api";
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function routeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) routeFiles(path, found);
    else if (entry === "route.ts") found.push(path);
  }
  return found;
}

/** The role group guarding a handler, read from its `withAuth` wrapper. */
function guardFor(source: string, method: string): string | null {
  const upper = method.toUpperCase();
  const assigned = source.search(new RegExp(`export const ${upper}\\s*=`));
  const bare = new RegExp(`export async function ${upper}\\s*\\(`).test(source);
  if (assigned < 0 && !bare) return null;
  if (assigned < 0) return "PUBLIC";

  const head = source.slice(assigned, assigned + 400);
  const named = head.match(/roles:\s*ROLES\.(\w+)/);
  if (named) return `ROLES.${named[1]}`;
  const local = head.match(/roles:\s*([A-Z_]+)\b/);
  if (local) return local[1];
  return /withAuth/.test(head) ? "AUTHENTICATED" : "PUBLIC";
}

/** `/api/referrals/[id]` → `/api/referrals/{id}`, and the parameter list. */
function toOpenApiPath(url: string) {
  const params: string[] = [];
  const path = url.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    params.push(name);
    return `{${name}}`;
  });
  return { path, params };
}

/* -------------------------------- schemas --------------------------------- */

const json = (schema: z.ZodType) => {
  const out = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  // OpenAPI 3.1 carries its own dialect; a nested `$schema` confuses some
  // importers (Postman among them) into treating the node as external.
  delete out.$schema;
  return out;
};

const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Access token from POST /api/auth/token. Valid 15 minutes; refresh with " +
        "POST /api/auth/token/refresh. If this header is present its verdict is " +
        "final — the server never falls back to a cookie.",
    },
  },
  schemas: {
    Error: {
      type: "object",
      required: ["error", "code"],
      properties: {
        error: { type: "string", description: "Human-readable Arabic. Not stable — do not branch on it." },
        code: {
          type: "string",
          description: "The machine-readable contract. Branch on this.",
          enum: [
            "MALFORMED_JSON", "VALIDATION_FAILED", "INVALID_QUERY_PARAM",
            "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND",
            "DUPLICATE_RESOURCE", "INVALID_REFERENCE", "INVALID_STATE_TRANSITION",
            "BUSINESS_RULE_VIOLATION", "RATE_LIMITED",
            "INTERNAL_ERROR", "UPSTREAM_UNAVAILABLE",
          ],
        },
        details: {
          type: "array",
          description: "Present on VALIDATION_FAILED. `field` is a dot path into the body you sent.",
          items: {
            type: "object",
            required: ["field", "code", "message"],
            properties: {
              field: { type: "string", example: "clinical.medications.0.dose" },
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
        requestId: { type: "string" },
      },
    },
    PageMeta: {
      type: "object",
      required: ["nextCursor", "hasMore", "limit"],
      properties: {
        nextCursor: {
          type: ["string", "null"],
          description: "Opaque keyset cursor over (createdAt, id). Do not parse or construct it.",
        },
        hasMore: { type: "boolean" },
        limit: { type: "integer", maximum: 100 },
        total: { type: "integer", description: "Only when explicitly requested — COUNT(*) is a scan." },
      },
    },
    Envelope: {
      type: "object",
      required: ["data"],
      properties: {
        data: {},
        meta: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            page: { $ref: "#/components/schemas/PageMeta" },
          },
        },
      },
    },
    // The four referral documents. `clinical` is a union DISCRIMINATED ON
    // `kind` — model it as a sealed type, not one struct of optional fields:
    // every schema is `.strict()`, so a merged struct sends keys that 400.
    RadiologyClinical: json(radiologyClinicalSchema),
    PharmacyClinical: json(pharmacyClinicalSchema),
    LabClinical: json(labClinicalSchema),
    DoctorClinical: json(doctorClinicalSchema),
    Medication: json(medicationSchema),
  },
} as const;

/** Request bodies derived from the schema the route validates with. */
const BODIES: Record<string, { schema: z.ZodType; summary: string }> = {
  "post /api/auth/token": { schema: tokenGrantSchema, summary: "Sign in — password, otp or google grant" },
  "post /api/auth/token/refresh": { schema: refreshBodySchema, summary: "Rotate the token pair" },
  "post /api/auth/otp/send": { schema: otpSendSchema, summary: "Send a verification code" },
  "post /api/referrals": { schema: createReferralSchema, summary: "Send one of the four referral documents" },
  "patch /api/referrals/{id}": { schema: respondReferralSchema, summary: "Reply to a referral, or withdraw it" },
  "post /api/v1/me/bookings": { schema: createBookingSchema, summary: "Book a service" },
  "patch /api/v1/me/profile": { schema: updateProfileSchema, summary: "Update my profile" },
  "post /api/prescriptions": { schema: createPrescriptionSchema, summary: "Write a prescription" },
  "post /api/v1/me/membership": { schema: purchaseMembershipSchema, summary: "Buy or renew a membership, paid from the wallet" },
};

/**
 * Endpoints outside `/api/v1` and `/api/public` that the patient app genuinely
 * needs, keyed by `method path`.
 *
 * The read-state endpoint is the whole list. It predates `/api/v1` and lives
 * under the unversioned tree, but the notifications screen cannot work without
 * it — tagging it `Internal` ("expected to change with the dashboards") would
 * hand the mobile team a screen they can only half-build. Tagged `Patient`, it
 * is covered by the same stability promise as the rest of that surface.
 */
const PATIENT_EXTRAS = new Set(["patch /api/notifications/{id}/read"]);

/**
 * Query parameters derived from the schema the route parses them with.
 *
 * Same principle as `BODIES`, and just as necessary: an endpoint whose entire
 * input is a query string, published with no parameters at all, documents
 * nothing a client can call.
 */
const QUERIES: Record<string, z.ZodType> = {
  "get /api/public/documents/verify": verifyDocumentQuerySchema,
};

/** Turn an object schema into OpenAPI `parameters`, one entry per property. */
function queryParameters(schema: z.ZodType) {
  const asJson = json(schema) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const required = new Set(asJson.required ?? []);
  return Object.entries(asJson.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: propertySchema,
  }));
}

/** Group endpoints so Postman shows readable folders. */
function tagFor(url: string, method: string, path: string): string {
  if (PATIENT_EXTRAS.has(`${method} ${path}`)) return "Patient";
  if (url.startsWith("/api/auth")) return "Auth";
  if (url.startsWith("/api/public/documents")) return "Public";
  if (url.startsWith("/api/public")) return "Public";
  if (url.startsWith("/api/v1/me")) return "Patient";
  if (url.startsWith("/api/v1")) return "Patient";
  if (url.startsWith("/api/referrals")) return "Referrals";
  if (url.startsWith("/api/dashboard")) return "Provider dashboard";
  return "Internal";
}

/**
 * The three groups a native client is allowed to call.
 *
 * The mobile app signs in as a PATIENT and nothing else, so 169 of the 193
 * operations are dashboard surface it can never reach. Handing over the full
 * spec means the client has to guess which of those apply to it; the filtered
 * spec answers that by construction.
 */
const MOBILE_TAGS = new Set(["Auth", "Public", "Patient"]);

/* --------------------------------- build ---------------------------------- */

const paths: Record<string, Record<string, unknown>> = {};
let handlerCount = 0;

for (const file of routeFiles(API_DIR).sort()) {
  const source = readFileSync(file, "utf8");
  const url =
    "/" +
    relative("src/app", file).replace(/\/route\.ts$/, "").replace(/\(([^)]+)\)\//g, "");

  // NextAuth's own catch-all is a browser redirect flow, not part of this API.
  if (url.includes("[...nextauth]")) continue;

  const { path, params } = toOpenApiPath(url);

  for (const method of METHODS) {
    const guard = guardFor(source, method);
    if (!guard) continue;
    handlerCount++;

    const key = `${method} ${path}`;
    const body = BODIES[key];
    const isPublic = guard === "PUBLIC";

    const operation: Record<string, unknown> = {
      tags: [tagFor(url, method, path)],
      summary: body?.summary ?? `${method.toUpperCase()} ${path}`,
      description: `Requires: **${guard}**`,
      operationId: `${method}${path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      security: isPublic ? [] : [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Success",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
        },
        "400": errorResponse("Validation failed — see `details`"),
        ...(isPublic ? {} : { "401": errorResponse("Missing, expired or invalid token") }),
        ...(isPublic ? {} : { "403": errorResponse("Authenticated, but not allowed") }),
        "404": errorResponse("Not found — or not yours; the two are deliberately indistinguishable"),
        "422": errorResponse("Refused by a domain rule — `error` explains why"),
        "429": errorResponse("Rate limited — back off"),
        "500": errorResponse("Server fault — retry with backoff and quote `requestId`"),
      },
    };

    const parameters = [
      ...params.map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      ...(QUERIES[key] ? queryParameters(QUERIES[key]) : []),
    ];
    if (parameters.length > 0) operation.parameters = parameters;

    if (body) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: json(body.schema) } },
      };
    }

    paths[path] ??= {};
    paths[path][method] = operation;
  }
}

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "وريد / Warid — HTTP API",
    version: "1.0.0",
    description: [
      "Generated from the route files and the Zod schemas the server validates with —",
      "run `npx tsx scripts/generate-openapi.ts` after changing a route.",
      "",
      "Read `docs/api/README.md` first: it carries the conventions this spec cannot",
      "express — Baghdad-day bucketing, the money contract, refresh-token rotation",
      "and its reuse detection, and what is not built yet.",
      "",
      "This is the FULL surface, most of which serves the web dashboards. The",
      "native app signs in as a PATIENT and can only reach `Auth`, `Public` and",
      "`Patient` — hand the mobile team `openapi.mobile.json` instead, which is",
      "this spec filtered to exactly those three.",
    ].join("\n"),
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development" },
    { url: "{baseUrl}", description: "Deployed", variables: { baseUrl: { default: "https://warid.app" } } },
  ],
  tags: [
    { name: "Auth", description: "Sign in, refresh, sign out" },
    { name: "Public", description: "Browsable with no token" },
    { name: "Patient", description: "The patient app surface (/api/v1)" },
    { name: "Referrals", description: "The four referral documents inside a medical complex" },
    { name: "Provider dashboard", description: "Partner worklists and earnings" },
    { name: "Internal", description: "Web dashboard surface — unversioned" },
  ],
  security: [{ bearerAuth: [] }],
  components,
  paths,
};

writeFileSync("docs/api/openapi.json", JSON.stringify(spec, null, 2) + "\n");

/* ----------------------------- the mobile spec ---------------------------- */

/**
 * The same spec with every operation the app cannot call removed.
 *
 * Not a convenience. A patient token is refused by all 169 dashboard
 * operations, so shipping the full file makes the client's first job guessing
 * which endpoints apply to it — and a guess that lands on a provider route
 * costs a round of "why is this 403" before anyone suspects the document.
 */
const mobilePaths: Record<string, Record<string, unknown>> = {};
let mobileOps = 0;

for (const [path, methods] of Object.entries(paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    const [tag] = (operation as { tags: string[] }).tags;
    if (!MOBILE_TAGS.has(tag)) continue;
    mobilePaths[path] ??= {};
    mobilePaths[path][method] = operation;
    mobileOps++;
  }
}

// The referral documents are provider-side and no mobile operation references
// them, so they would ship as dead weight the client has to read past.
const { RadiologyClinical, PharmacyClinical, LabClinical, DoctorClinical, Medication, ...mobileSchemas } =
  components.schemas;
void RadiologyClinical, PharmacyClinical, LabClinical, DoctorClinical, Medication;

writeFileSync(
  "docs/api/openapi.mobile.json",
  JSON.stringify(
    {
      ...spec,
      info: {
        ...spec.info,
        title: "وريد / Warid — Patient app API",
        description: [
          "The endpoints a native patient app may call — nothing else.",
          "",
          "Generated by `npx tsx scripts/generate-openapi.ts` from the route files and",
          "the Zod schemas the server validates with, then filtered to the three groups",
          "a PATIENT token can reach. Every other endpoint in this codebase would answer",
          "403 to this app, so none of them are here.",
          "",
          "Read `docs/api/README.md` for the conventions a schema cannot express:",
          "refresh-token rotation and its reuse detection, Baghdad-day bucketing, money",
          "as a JSON number, and that 404 also means \"not yours\".",
        ].join("\n"),
      },
      tags: spec.tags.filter((t) => MOBILE_TAGS.has(t.name)),
      components: { ...components, schemas: mobileSchemas },
      paths: mobilePaths,
    },
    null,
    2
  ) + "\n"
);

console.log(
  `docs/api/openapi.json        — ${Object.keys(paths).length} paths, ${handlerCount} operations, ` +
    `${Object.keys(BODIES).length} request bodies derived from live Zod schemas\n` +
    `docs/api/openapi.mobile.json — ${Object.keys(mobilePaths).length} paths, ${mobileOps} operations ` +
    `(Auth + Public + Patient)`
);
