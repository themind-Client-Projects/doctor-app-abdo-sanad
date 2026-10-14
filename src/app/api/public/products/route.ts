import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/public/products — a pharmacy's catalogue (المنتجات).
 *
 * `Product` has existed since the pharmacy catalogue was modelled, with the
 * express purpose of letting a basket be priced server-side, and nothing ever
 * read it: the one page that lists products imported `DEMO_PRODUCTS`, so every
 * price and every stock flag on screen was written in a frontend constant.
 *
 * `pharmacyId` is required. A catalogue is a property of one pharmacy, and a
 * platform-wide product list is a different product question than this route
 * is here to answer.
 */

const listQuerySchema = z.object({
  pharmacyId: z.string().trim().min(1),
  /** Which storefront is asking — decides whether the pharmacy is visible. */
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
  category: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  cursor: z.string().optional(),
});

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { pharmacyId, channel, category, q, limit, cursor } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.ProductWhereInput = {
    pharmacyId,
    deletedAt: null,
    // The catalogue inherits the pharmacy's visibility. Without this a
    // suspended pharmacy's products stay browsable at a guessable URL.
    pharmacy: {
      status: "ACTIVE",
      deletedAt: null,
      channels: { some: { channel, status: { not: "SUSPENDED" } } },
    },
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const keyset = keysetArgs(cursor, limit);
  const rows = await prisma.product.findMany({
    where: keyset.where ? { AND: [where, keyset.where] } : where,
    take: keyset.take,
    orderBy: keyset.orderBy,
    select: {
      id: true,
      createdAt: true,
      name: true,
      description: true,
      category: true,
      price: true,
      imageUrl: true,
      inStock: true,
      requiresRx: true,
      pharmacyId: true,
    },
  });

  const { items, page } = toPage(rows, limit);

  const data = items.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    // The UI type wants a string; an uncategorised product groups under «أخرى»
    // rather than rendering an empty chip.
    category: p.category ?? "أخرى",
    price: Number(p.price),
    // Nullable in the database and there is no stock photo to substitute, so
    // the card draws its own placeholder rather than a broken image.
    image: p.imageUrl,
    inStock: p.inStock,
    requiresRx: p.requiresRx,
    pharmacyId: p.pharmacyId,
  }));

  return okList(data, page, { requestId });
});
