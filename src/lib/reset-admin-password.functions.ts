import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

/**
 * Reset an admin user's password after EmailJS OTP verification.
 * Uses the service role so no Supabase session is required.
 */
export const resetAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error(listErr.message);

    const user = users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) {
      throw new Error("No admin account found with that email.");
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      throw new Error("No admin account found with that email.");
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

/**
 * Check whether an email belongs to an admin account before sending OTP.
 */
export const verifyAdminEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error(listErr.message);

    const user = users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) {
      throw new Error("No admin account found with that email.");
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      throw new Error("No admin account found with that email.");
    }

    return { ok: true };
  });
