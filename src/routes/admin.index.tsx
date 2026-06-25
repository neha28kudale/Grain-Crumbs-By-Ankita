import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({\
  head: () => ({ meta: [{ title: "Admin Dashboard — Grain Crumbs" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

type Order = {
  id: string;
  order_number: number;
  name: string;
  phone: string;
  email: string | null;
  product_type: string;
  flavour: string | null;
  weight: string | null;
  cake_message: string | null;
  theme: string | null;
  delivery: string;
  address: string | null;
  occasion: string | null;
  date_required: string | null;
  notes: string | null;
  status: "new" | "contacted" | "confirmed" | "completed" | "cancelled";
  created_at: string;
};

const STATUSES: Order["status"][] = ["new", "contacted", "confirmed", "completed", "cancelled"];
const STATUS_STYLES: Record<Order["status"], string> = {
  new: "bg-[color:var(--gold)]/20 text-[color:var(--chocolate-dark)] border-[color:var(--gold)]",
  contacted: "bg-blue-100 text-blue-900 border-blue-300",
  confirmed: "bg-amber-100 text-amber-900 border-amber-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  cancelled: "bg-red-100 text-red-900 border-red-300",
};

const PAGE_SIZE = 20;

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Order | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/admin/login" });
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        await supabase.auth.signOut();
        navigate({ to: "/admin/login" });
        return;
      }
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (!error && data) setOrders(data as Order[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Reset to page 1 whenever filter or search changes
  useEffect(() => { setPage(1); }, [filter, q]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !o.name.toLowerCase().includes(s) &&
          !o.phone.toLowerCase().includes(s) &&
          !(o.email ?? "").toLowerCase().includes(s) &&
          !o.product_type.toLowerCase().includes(s) &&
          !(o.flavour ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [orders, filter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (id: string, status: Order["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    if (active?.id === id) setActive({ ...active, status });
    await supabase.from("orders").update({ status }).eq("id", id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="section">
      <div className="container-prose">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="divider-gold eyebrow">Admin</p>
            <h1 className="mt-3 font-display text-4xl md:text-5xl">Orders</h1>
            <p className="mt-2 text-sm text-muted-foreground">{filtered.length} of {orders.length} enquiries</p>
          </div>
          <button onClick={signOut} className="btn-outline"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search name, phone, email, product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition ${
                  filter === s
                    ? "border-[color:var(--chocolate-dark)] bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]"
                    : "border-border bg-background hover:border-[color:var(--gold)]"
                }`}
              >{s}</button>
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--cream-dark)]/40 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Order #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Mobile</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Flavour</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Date Req.</th>
                  <th className="px-4 py-3 text-left">Order Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No orders found.</td></tr>
                ) : paginated.map((o) => (
                  <tr key={o.id} onClick={() => setActive(o)} className="cursor-pointer border-t border-border hover:bg-[color:var(--cream-dark)]/30">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-[color:var(--chocolate-dark)]">#{o.order_number}</td>
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">{o.phone}</td>
                    <td className="px-4 py-3">{o.product_type}</td>
                    <td className="px-4 py-3">{o.flavour ?? "—"}</td>
                    <td className="px-4 py-3">{o.weight ?? "—"}</td>
                    <td className="px-4 py-3">{o.date_required ?? "—"}</td>
                    <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:border-[color:var(--gold)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`h-8 min-w-[2rem] rounded-md border px-2 text-xs transition ${
                          page === p
                            ? "border-[color:var(--chocolate-dark)] bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]"
                            : "border-border bg-background hover:border-[color:var(--gold)]"
                        }`}
                      >{p}</button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:border-[color:var(--gold)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setActive(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-[1.5rem] md:rounded-[1.5rem] border border-border bg-card p-6 md:max-w-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Enquiry</p>
                <h2 className="mt-2 font-display text-3xl">{active.name}</h2>
                <p className="text-sm text-muted-foreground">{active.phone}{active.email && ` · ${active.email}`}</p>
                {active.order_number && (
                  <p className="mt-1 inline-block rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--cream-dark)]/50 px-3 py-1 font-mono text-sm font-semibold text-[color:var(--chocolate-dark)]">
                    #{active.order_number}
                  </p>
                )}
              </div>
              <button onClick={() => setActive(null)} className="text-2xl leading-none text-muted-foreground hover:text-foreground">×</button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Detail label="Product" value={active.product_type} />
              <Detail label="Flavour" value={active.flavour} />
              <Detail label="Weight/Qty" value={active.weight} />
              <Detail label="Delivery" value={active.delivery} />
              <Detail label="Occasion" value={active.occasion} />
              <Detail label="Date required" value={active.date_required} />
              <Detail label="Cake message" value={active.cake_message} full />
              <Detail label="Theme" value={active.theme} full />
              <Detail label="Address" value={active.address} full />
              <Detail label="Notes" value={active.notes} full />
              <Detail label="Submitted" value={new Date(active.created_at).toLocaleString()} full />
            </dl>

            <div className="mt-8 border-t border-border pt-6">
              <p className="eyebrow mb-3">Update status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(active.id, s)}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition ${
                      active.status === s
                        ? "border-[color:var(--chocolate-dark)] bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]"
                        : "border-border bg-background hover:border-[color:var(--gold)]"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value, full }: { label: string; value: string | null | undefined; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value || "—"}</dd>
    </div>
  );
}