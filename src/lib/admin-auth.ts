import { supabase } from "@/integrations/supabase/client";

function isMissingRpc(errorMessage: string) {
  return (
    errorMessage.includes("Could not find the function") ||
    errorMessage.includes("is_admin_email")
  );
}

function isMissingEdgeFunction(errorMessage: string) {
  return (
    errorMessage.includes("Requested function was not found") ||
    errorMessage.includes("NOT_FOUND")
  );
}

export async function verifyAdminEmailClient(
  email: string,
  fallback?: () => Promise<unknown>,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_admin_email", {
    check_email: email.trim(),
  });

  if (error) {
    if (fallback && isMissingRpc(error.message)) {
      await fallback();
      return;
    }
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No admin account found with that email.");
  }
}

export async function resetAdminPasswordClient(
  email: string,
  password: string,
  fallback?: () => Promise<unknown>,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("reset-admin-password", {
    body: { email: email.trim(), password },
  });

  if (error) {
    if (fallback && isMissingEdgeFunction(error.message)) {
      await fallback();
      return;
    }
    throw new Error(error.message);
  }

  const payload = data as { error?: string; success?: boolean } | null;
  if (payload?.error) {
    throw new Error(payload.error);
  }
}
