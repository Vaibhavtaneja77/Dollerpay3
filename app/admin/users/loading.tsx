import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <>
      <PageHeader title="Users" description="Loading customer accounts." />
      <ListSkeleton />
    </>
  );
}
