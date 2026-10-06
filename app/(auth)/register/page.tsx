import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const params = await searchParams;
  const referralCode = params.ref?.trim().toUpperCase() ?? null;
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-md animate-scale-in rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-medium text-zinc-500">DollerPay</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">Create account</h1>
        </div>
        <AuthForm mode="register" referralCode={referralCode} />
        <p className="mt-5 text-sm text-zinc-600">
          Already registered? <Link className="font-medium text-ink hover:underline" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
