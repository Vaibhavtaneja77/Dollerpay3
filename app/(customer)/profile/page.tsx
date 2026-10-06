import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustomer } from "@/lib/auth";

export default async function ProfilePage() {
  const { profile } = await requireCustomer();
  return (
    <>
      <PageHeader title="Account" description="Review the account details currently attached to your customer profile." backHref="/dashboard" />
      <Card className="animate-fade-up">
        <CardHeader><h1 className="text-2xl font-semibold">Profile</h1></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p><span className="text-zinc-500">Email:</span> {profile?.email}</p>
          <p><span className="text-zinc-500">Status:</span> {profile?.status}</p>
        </CardContent>
      </Card>
    </>
  );
}
