import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <>
      <PageHeader title="Payout Orders" description="Loading payout order queue." />
      <ListSkeleton />
    </>
  );
}
