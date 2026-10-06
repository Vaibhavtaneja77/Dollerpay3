import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";

export default async function OnboardingPage() {
  await requireCustomer();
  redirect("/dashboard");
}
