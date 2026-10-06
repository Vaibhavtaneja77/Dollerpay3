import { PasswordResetForm } from "@/components/password-reset-form";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-md animate-scale-in rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-medium text-zinc-500">DollerPay</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">Reset password</h1>
        <PasswordResetForm />
      </section>
    </main>
  );
}
