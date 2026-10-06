import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 rounded-2xl border border-line bg-white p-3 shadow-sm sm:mb-6 sm:p-6 lg:rounded-lg lg:shadow-soft">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-[2rem]">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600 sm:mt-2 sm:text-sm sm:leading-6">{description}</p> : null}
          </div>
          {actions ? <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">{actions}</div> : null}
        </div>

        {backHref ? (
          <div className="hidden gap-2 lg:flex lg:flex-wrap">
            <Link href={backHref}>
              <Button variant="secondary" className="h-10 w-full px-3 sm:w-auto">
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="h-10 w-full px-3 sm:w-auto">
                <Home className="h-4 w-4" aria-hidden />
                Dashboard
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
