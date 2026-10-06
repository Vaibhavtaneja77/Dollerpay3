import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <>
      <PageHeader title="Top-up Requests" description="Loading submitted customer top-up proofs." />
      <ListSkeleton />
    </>
  );
}
