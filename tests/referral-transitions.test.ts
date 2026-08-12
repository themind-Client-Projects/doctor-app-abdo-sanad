import { describe, expect, it } from "vitest";
import {
  REFERRAL_STATUSES,
  type ReferralStatus,
  attachmentsSchema,
  canTransition,
  parseAttachments,
} from "@/server/services/referral-rules";

/**
 * The referral state machine, and who is allowed to move it.
 *
 * A referral is a clinical record of what happened to a patient, so the rules
 * that matter are the ones that stop it from saying something untrue:
 *
 *   - a finished referral cannot be reopened and its result rewritten
 *   - the sender cannot withdraw work the recipient has already started
 *   - the sender cannot write the result — only the party who did the work
 *     (enforced in the route; the transitions here are the other half)
 */

const ALL = REFERRAL_STATUSES;

describe("only the recipient moves a referral forward", () => {
  it.each([
    ["sent", "received"],
    ["sent", "in_progress"],
    ["sent", "completed"],
    ["received", "in_progress"],
    ["received", "completed"],
    ["in_progress", "completed"],
  ] as const)("recipient may go %s → %s", (from, to) => {
    expect(canTransition(from, to, "recipient")).toBe(true);
  });

  it("the recipient can never cancel — withdrawing is the sender's act", () => {
    for (const from of ALL) {
      expect(canTransition(from, "cancelled", "recipient")).toBe(false);
    }
  });

  it("never moves backwards", () => {
    expect(canTransition("in_progress", "received", "recipient")).toBe(false);
    expect(canTransition("completed", "in_progress", "recipient")).toBe(false);
    expect(canTransition("received", "sent", "recipient")).toBe(false);
  });
});

describe("the sender may withdraw, but only before work starts", () => {
  it.each([
    ["sent", true],
    ["received", true],
    ["in_progress", false],
    ["completed", false],
    ["cancelled", false],
  ] as const)("from %s → cancelled: %s", (from, allowed) => {
    expect(canTransition(from, "cancelled", "sender")).toBe(allowed);
  });

  it("the sender cannot advance the work either", () => {
    const forward: ReferralStatus[] = ["received", "in_progress", "completed"];
    for (const to of forward) {
      expect(canTransition("sent", to, "sender")).toBe(false);
    }
  });
});

describe("a closed referral is closed for everyone", () => {
  it.each(["completed", "cancelled"] as const)("%s accepts no transition at all", (from) => {
    for (const to of ALL) {
      expect(canTransition(from, to, "recipient")).toBe(false);
      expect(canTransition(from, to, "sender")).toBe(false);
    }
  });
});

describe("attachments cannot smuggle a script into a dashboard", () => {
  it("refuses javascript: and other executable schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.example/result.pdf",
      "/\\evil.example",
      "http://plain.example/result.pdf",
    ]) {
      expect(attachmentsSchema.safeParse([{ url, name: "نتيجة" }]).success).toBe(false);
    }
  });

  it("accepts an internal path and an https URL", () => {
    const ok = attachmentsSchema.safeParse([
      { url: "/files/result.pdf", name: "نتيجة التحليل" },
      { url: "https://storage.example/result.png", name: "صورة" },
    ]);
    expect(ok.success).toBe(true);
  });

  it("caps the list, so one referral cannot carry an unbounded payload", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      url: `https://s.example/${i}.pdf`,
      name: `م${i}`,
    }));
    expect(attachmentsSchema.safeParse(many).success).toBe(false);
  });

  it("refuses unknown keys rather than storing them", () => {
    const sneaky = [{ url: "/a.pdf", name: "n", onclick: "alert(1)" }];
    expect(attachmentsSchema.safeParse(sneaky).success).toBe(false);
  });
});

describe("reading attachments back out of a Json column", () => {
  it("keeps the good rows and drops the malformed ones", () => {
    const stored = [
      { url: "/ok.pdf", name: "سليم" },
      { url: "javascript:alert(1)", name: "خبيث" },
      "not-an-object",
      null,
      { url: "/second.pdf", name: "سليم ٢" },
    ];
    const parsed = parseAttachments(stored as never);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((a) => a.url)).toEqual(["/ok.pdf", "/second.pdf"]);
  });

  it("survives a column that is not an array at all", () => {
    expect(parseAttachments(null)).toEqual([]);
    expect(parseAttachments({ url: "/a" } as never)).toEqual([]);
  });
});
