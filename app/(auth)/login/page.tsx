import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-md animate-scale-in rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-medium text-zinc-500">DollerPay</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">Sign in</h1>
        </div>
        <AuthForm mode="login" />
        <div className="mt-5 flex items-center justify-between text-sm">
          <Link className="font-medium hover:underline" href="/forgot-password">Forgot password</Link>
          <Link className="font-medium hover:underline" href="/register">Create account</Link>
        </div>
      </section>
    </main>
  );
}
