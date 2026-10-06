import { AutoLoadMore } from "@/components/auto-load-more";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPermission } from "@/lib/auth";
import { formatIstDateTime } from "@/lib/utils";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 50), 300);
  const { supabase } = await requireAdminPermission("can_manage_admins");
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const userSideIssues = (logs ?? []).filter((log) => log.action === "USER_SIDE_ERROR" || log.action === "USER_SIDE_NOT_FOUND").length;

  return (
    <>
      <PageHeader title="Audit Logs" description="Review important platform actions, admin changes, order state moves, wallet-affecting events, and user-side page issues." />
      {userSideIssues ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{userSideIssues} recent user-side page issue{userSideIssues === 1 ? "" : "s"}</p>
          <p className="mt-1 text-amber-800">Check the highlighted audit rows for the route, user, and browser details.</p>
        </div>
      ) : null}
      {logs?.length ? (
        <div className="rounded-lg border border-line bg-white shadow-soft">
          <div className="grid gap-3 p-3 lg:hidden">
            {logs.map((log) => (
              <div key={log.id} className={`grid gap-3 rounded-lg border p-4 ${isUserSideIssue(log.action) ? "border-amber-200 bg-amber-50/70" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{log.action}</p>
                  <p className="text-xs text-zinc-500">{formatIstDateTime(log.created_at)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Entity" value={`${log.entity_type} / ${log.entity_id}`} />
                  <Info label="Actor" value={log.actor_id ?? "System"} />
                </div>
                <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">{JSON.stringify(log.metadata, null, 2)}</pre>
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto lg:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-3">Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Metadata</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={`border-t border-line align-top ${isUserSideIssue(log.action) ? "bg-amber-50/70" : ""}`}>
                    <td className="p-3 font-medium">{log.action}</td>
                    <td>
                      <p>{log.entity_type}</p>
                      <p className="mt-1 max-w-44 truncate font-mono text-xs text-zinc-500">{log.entity_id}</p>
                    </td>
                    <td className="font-mono text-xs">{log.actor_id ?? "System"}</td>
                    <td><pre className="max-h-28 max-w-md overflow-auto rounded bg-zinc-50 p-2 text-xs">{JSON.stringify(log.metadata, null, 2)}</pre></td>
                    <td>{formatIstDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No audit logs yet" description="Security and operational events will appear here after platform activity." />
      )}
      {(logs?.length ?? 0) >= limit && limit < 300 ? <AutoLoadMore href={`/admin/audit?limit=${limit + 50}`} /> : null}
    </>
  );
}

function isUserSideIssue(action: string) {
  return action === "USER_SIDE_ERROR" || action === "USER_SIDE_NOT_FOUND";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-medium text-zinc-800">{value}</p>
    </div>
  );
}
