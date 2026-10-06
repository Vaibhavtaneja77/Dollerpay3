import { NotificationPreferences } from "@/components/notification-preferences";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustomer } from "@/lib/auth";

export default async function SettingsPage() {
  await requireCustomer();
  return (
    <>
      <PageHeader title="Settings" description="Manage notification preferences for important account and transaction updates." backHref="/dashboard" />
      <div className="grid gap-6">
        <NotificationPreferences />
      </div>
    </>
  );
}
