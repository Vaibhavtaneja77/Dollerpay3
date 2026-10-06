import { createAdminClient } from "@/lib/supabase/admin";

type BanLookup = {
  userId?: string | null;
  email?: string | null;
};

export type BanStatusDetails = {
  isBanned: boolean;
  reason: string | null;
  email: string | null;
  userId: string | null;
};

export async function getBanStatusDetails({ userId, email }: BanLookup): Promise<BanStatusDetails> {
  const admin = createAdminClient();

  let resolvedUserId = userId ?? null;
  let resolvedEmail = email?.trim().toLowerCase() ?? null;

  if (!resolvedUserId && resolvedEmail) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id,email,status")
      .eq("email", resolvedEmail)
      .maybeSingle();

    if (!profile) {
      return { isBanned: false, reason: null, email: resolvedEmail, userId: null };
    }

    resolvedUserId = profile.id;
    resolvedEmail = profile.email;

    if (profile.status !== "banned") {
      return { isBanned: false, reason: null, email: resolvedEmail, userId: resolvedUserId };
    }
  }

  if (!resolvedUserId) {
    return { isBanned: false, reason: null, email: resolvedEmail, userId: null };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,email,status")
    .eq("id", resolvedUserId)
    .maybeSingle();

  if (!profile || profile.status !== "banned") {
    return { isBanned: false, reason: null, email: profile?.email ?? resolvedEmail, userId: profile?.id ?? resolvedUserId };
  }

  const { data: audit } = await admin
    .from("audit_logs")
    .select("metadata")
    .eq("entity_type", "profile")
    .eq("entity_id", profile.id)
    .eq("action", "USER_BANNED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = audit?.metadata;
  const reason =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) && "reason" in metadata && typeof metadata.reason === "string"
      ? metadata.reason
      : null;

  return {
    isBanned: true,
    reason,
    email: profile.email,
    userId: profile.id
  };
}
