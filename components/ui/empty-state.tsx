import { Inbox } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line bg-white p-6 text-center animate-fade-up sm:p-10">
      <div className="mb-4 rounded-full bg-zinc-100 p-3">
        <Inbox className="h-6 w-6 text-zinc-500" aria-hidden />
      </div>
      <p className="text-base font-semibold text-zinc-800">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">{description}</p> : null}
      {action ? <div className="mt-4 grid w-full justify-items-center">{action}</div> : null}
    </div>
  );
}
