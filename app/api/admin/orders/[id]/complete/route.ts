import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { getSafeUploadExtension, isSafeStoredPaymentAssetPath, rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, PAYMENT_ASSET_BUCKET } from "@/lib/transaction-rules";
import { adminCompleteSchema } from "@/lib/validation";

const allowedProofTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireAdminPermission("can_manage_orders");
    await syncPendingExpirations();
    const limited = await rateLimitResponse(`admin-complete:${user.id}`, 20);
    if (limited) return limited;

    const contentType = request.headers.get("content-type") ?? "";
    let proofPath = "";
    let note: string | null = null;
    let uploadedProofPath: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const proof = form.get("proof");
      note = String(form.get("note") ?? "").trim() || null;

      if (!(proof instanceof File) || proof.size === 0) {
        return ok({ error: "Upload payout proof before completing the order." }, { status: 422 });
      }
      if (!allowedProofTypes.has(proof.type)) {
        return ok({ error: "Upload a PNG, JPG, WEBP, or PDF payout proof." }, { status: 422 });
      }
      if (proof.size > MAX_UPLOAD_BYTES) {
        return ok({ error: `Payout proof must be ${MAX_UPLOAD_MB} MB or smaller.` }, { status: 422 });
      }

      const extension = getSafeUploadExtension(proof, allowedProofTypes);
      if (!extension) return ok({ error: "Payout proof file extension must match the uploaded file type." }, { status: 422 });
      proofPath = `payouts/${id}/${crypto.randomUUID()}.${extension}`;
      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from(PAYMENT_ASSET_BUCKET)
        .upload(proofPath, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedProofPath = proofPath;
    } else {
      const body = adminCompleteSchema.parse(await request.json());
      proofPath = body.proof_path;
      note = body.note ?? null;
      if (!isSafeStoredPaymentAssetPath(proofPath)) {
        return ok({ error: "Invalid payout proof path." }, { status: 422 });
      }
    }

    const { error } = await supabase.rpc("complete_sell_order", {
      p_order_id: id,
      p_admin_id: user.id,
      p_payment_proof_path: proofPath,
      p_note: note
    });
    if (error) {
      if (uploadedProofPath) await createAdminClient().storage.from(PAYMENT_ASSET_BUCKET).remove([uploadedProofPath]);
      throw error;
    }
    return ok({ completed: true });
  } catch (error) {
    return fail(error);
  }
}
