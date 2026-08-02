import { PageSkeleton } from "@/components/shared/page-skeleton";

/** Shown while this route's bundle downloads — see PageSkeleton. */
export default function Loading() {
  return <PageSkeleton />;
}
