import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  channelPath,
  channelPrefix,
  doctorProfilePath,
  storefrontCategories,
} from "@/lib/channel-routes";

/**
 * سند and the public app are two catalogues over the same models: different
 * providers, different prices, separate routes.
 *
 * They were wired together by hand and drifted. The Sanad home pointed ALL FIVE
 * of its categories at the public routes, so tapping "الأطباء" inside سند
 * dropped the patient into the public pool at public prices. The doctor profile
 * had the same slip in a place where it costs money: reached from سند it still
 * asked for the DIRECT price, so a doctor browsed at 20,000 opened at 25,000.
 *
 * The last test is the one that matters long-term — it reads the Sanad route
 * tree and fails if a hardcoded public link comes back.
 */

describe("channel prefixes", () => {
  it("puts سند under /sanad and the public app at the root", () => {
    expect(channelPrefix("SANAD")).toBe("/sanad");
    expect(channelPrefix("DIRECT")).toBe("");
  });

  it("sends COMPLEX to the public routes rather than inventing a prefix", () => {
    // A complex is reached through /complexes/[id]; it has no parallel
    // catalogue, and guessing "/complex/doctors" would 404.
    expect(channelPrefix("COMPLEX")).toBe("");
  });

  it.each([
    ["SANAD", "/doctors", "/sanad/doctors"],
    ["SANAD", "/labs", "/sanad/labs"],
    ["DIRECT", "/doctors", "/doctors"],
  ] as const)("channelPath(%s, %s) → %s", (channel, path_, expected) => {
    expect(channelPath(channel, path_)).toBe(expected);
  });
});

describe("doctor profile stays in the storefront it was opened from", () => {
  it("keeps a Sanad browse on the Sanad profile", () => {
    expect(doctorProfilePath("SANAD", "doc-1")).toBe("/sanad/doctors/profile/doc-1");
  });

  it("keeps a public browse on the public profile", () => {
    expect(doctorProfilePath("DIRECT", "doc-1")).toBe("/doctors/profile/doc-1");
  });

  it("never returns the same path for both channels", () => {
    expect(doctorProfilePath("SANAD", "x")).not.toBe(doctorProfilePath("DIRECT", "x"));
  });
});

describe("storefront categories", () => {
  it("keeps every Sanad category inside سند", () => {
    const sanad = storefrontCategories("SANAD");
    for (const href of Object.values(sanad)) {
      expect(href.startsWith("/sanad/")).toBe(true);
    }
  });

  it("keeps every public category out of سند", () => {
    const direct = storefrontCategories("DIRECT");
    for (const href of Object.values(direct)) {
      expect(href.startsWith("/sanad")).toBe(false);
    }
  });
});

describe("the Sanad route tree does not link into the public storefront", () => {
  /** Routes that exist in BOTH storefronts — the ones that can be confused. */
  const DUAL = ["/doctors", "/labs", "/pharmacies", "/nursing", "/physiotherapy"];

  /**
   * `/search` is excluded on purpose: it lives under the `(sanad)` folder for
   * layout reasons but its URL is `/search` and it is a GLOBAL page, so linking
   * the public browse routes from it is correct.
   */
  const GLOBAL_PAGES = ["search"];

  function sanadFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!GLOBAL_PAGES.includes(entry.name)) sanadFiles(full, out);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("has no hardcoded public link in any سند page", () => {
    const offenders: string[] = [];

    for (const file of sanadFiles("src/app/(patient)/(sanad)")) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const route of DUAL) {
          // `href="/doctors"` but not `href="/sanad/doctors"`.
          const re = new RegExp(`["'\`]${route}(["'\`?/])`, "g");
          if (re.test(line) && !line.includes(`/sanad${route}`)) {
            offenders.push(`${file}:${i + 1} → ${route}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
