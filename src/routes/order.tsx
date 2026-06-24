import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, MessageCircle, ShoppingBag } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { estimateDelivery } from "@/lib/delivery-estimate";
import { useCart, formatCartSummary } from "@/lib/cart-context";

const EMAILJS_SERVICE_ID = "service_uzxszot";
const EMAILJS_TEMPLATE_ID = "template_9mm79jb";
const EMAILJS_PUBLIC_KEY = "FVFudd1L2Yxx2YziQ";

export const Route = createFileRoute("/order")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: (search.from as string) ?? "",
  }),
  head: () => ({
    meta: [
      { title: "Order Now — Grain Crumbs" },
      { name: "description", content: "Place an order for Grain Crumbs millet brownies, brownie cakes, gift boxes or bulk orders. Pickup or delivery across Pune." },
      { property: "og:title", content: "Order Now — Grain Crumbs" },
      { property: "og:description", content: "Customise and request your Grain Crumbs order." },
    ],
  }),
  component: OrderPage,
});

type ProductType = "Brownies" | "Brownie Cake" | "Gift Box" | "Bulk / Corporate Order";
type Delivery = "Pickup" | "Delivery";

const productTypes: ProductType[] = ["Brownies", "Brownie Cake", "Gift Box", "Bulk / Corporate Order"];
const flavoursList = [
  "Chocolate Walnut", "Cappuccino Walnut", "Mixed Berry Jam",
  "Coconut Bounty", "Cream Cheese", "Hazelnut Spread",
];
const weights = ["250g", "500g", "650g", "1kg"];
const occasions = ["Birthday", "Anniversary", "Corporate Event", "Gift", "Other"];

function OrderPage() {
  const { from } = useSearch({ from: "/order" });
  const { items: cartItems, subtotal: cartSubtotal, clearCart } = useCart();
  const hasCart = from === "cart" && cartItems.length > 0;
  const cartSummary = formatCartSummary(cartItems);

  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    type: (hasCart ? "Brownies" : "Brownies") as ProductType,
    flavour: flavoursList[0],
    weight: weights[1],
    browniePieces: "12 pieces",
    message: "", theme: "",
    giftTheme: "",
    delivery: "Pickup" as Delivery,
    address: "",
    pincode: "",
    occasion: "Birthday",
    date: "",
    notes: "",
  });

  const estimate = estimateDelivery(form.pincode);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const waMessage = useMemo(() => {
    const lines = [
      `*New enquiry — Grain Crumbs*`,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      form.email && `Email: ${form.email}`,
      `Product: ${form.type}`,
      hasCart && form.type === "Brownies"
        ? `Cart: ${cartSummary} (Est. ₹${cartSubtotal})`
        : `Flavour: ${form.flavour}`,
      form.type === "Brownie Cake" && `Weight: ${form.weight}`,
      form.message && `Cake message: ${form.message}`,
      form.theme && `Theme: ${form.theme}`,
      `Delivery: ${form.delivery}`,
      form.delivery === "Delivery" && form.address && `Address: ${form.address}`,
      `Occasion: ${form.occasion}`,
      form.date && `Date required: ${form.date}`,
      form.notes && `Notes: ${form.notes}`,
    ].filter(Boolean).join("\n");
    return encodeURIComponent(lines);
  }, [form, hasCart, cartSummary, cartSubtotal]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cartNotes = hasCart && form.type === "Brownies"
        ? [form.notes, `Cart: ${cartSummary} (Est. ₹${cartSubtotal})`].filter(Boolean).join("\n")
        : form.notes || null;

      const { data, error } = await supabase.from("orders").insert({
        name: form.name,
        phone: form.phone,
        email: form.email,
        product_type: form.type,
        flavour: form.type === "Brownies" || form.type === "Brownie Cake"
          ? hasCart && form.type === "Brownies"
            ? cartItems.map((i) => i.name).join(", ")
            : form.flavour
          : null,
        weight: form.type === "Brownie Cake"
          ? form.weight
          : form.type === "Brownies" && !hasCart
            ? form.browniePieces
            : hasCart ? cartSummary : null,
        cake_message: form.message || null,
        theme: form.type === "Brownie Cake"
          ? form.theme || null
          : form.type === "Gift Box" ? form.giftTheme : null,
        delivery: form.delivery,
        address: form.delivery === "Delivery" ? form.address : null,
        occasion: form.occasion,
        date_required: form.date || null,
        notes: cartNotes,
      }).select("order_number").single();

      if (error) throw error;

      const newOrderNumber = data?.order_number ?? null;
      setOrderNumber(newOrderNumber);

      // Send confirmation email via EmailJS (non-blocking)
      try {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
              to_email: form.email,
              customer_name: form.name,
              order_number: String(newOrderNumber ?? ""),
              product_type: form.type,
              delivery: form.delivery === "Delivery" ? `Delivery to ${form.address}` : "Pickup",
              date_required: form.date || "To be confirmed",
            },
          }),
        });
      } catch (emailErr) {
        console.warn("Email failed (order still saved):", emailErr);
      }

      if (hasCart) clearCart();
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Could not submit. Please try WhatsApp instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="section">
        <div className="container-prose max-w-2xl">
          <Reveal>
            <div className="rounded-[2rem] border border-[color:var(--gold)]/30 bg-card p-10 text-center md:p-14">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color:var(--gold)] text-[color:var(--chocolate-dark)]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-6 font-display text-4xl md:text-5xl">Thank you!</h1>
              {orderNumber !== null && (
                <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--cream-dark)]/40 px-6 py-4">
                  <span className="eyebrow !mb-1">Your Order Number</span>
                  <span className="font-display text-3xl text-[color:var(--chocolate-dark)]">#{orderNumber}</span>
                </div>
              )}
              <p className="mt-4 text-muted-foreground">
                We've received your request and a confirmation email is on its way to <strong>{form.email}</strong>.
                We'll contact you shortly to confirm availability, pricing and customisation details.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Prefer to chat? Send the same details on WhatsApp for the fastest reply.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href={`https://wa.me/918208257574?text=${waMessage}`} target="_blank" rel="noreferrer" className="btn-gold">
                  <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                </a>
                <Link to="/" className="btn-outline">Back to home</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-border/60">
        <div className="container-prose py-16 text-center md:py-20">
          <p className="divider-gold eyebrow">Place an Order</p>
          <h1 className="mt-5 font-display text-5xl md:text-6xl">Tell us what to bake.</h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Fill in the form below and we'll get back within a few hours with availability, pricing and the next steps.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-prose grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <Reveal>
            <form onSubmit={onSubmit} className="space-y-10 rounded-[2rem] border border-border bg-card p-6 md:p-10">

              {/* Cart summary banner */}
              {hasCart && (
                <div className="rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--cream-dark)]/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <ShoppingBag className="h-5 w-5 text-[color:var(--gold)]" />
                    <span className="font-display text-lg">Your Cart</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {cartItems.map((item) => (
                      <li key={item.slug} className="flex justify-between">
                        <span>{item.name} × {item.quantity}</span>
                        <span>₹{item.price * item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-medium">
                    <span>Estimated Total</span>
                    <span>₹{cartSubtotal}</span>
                  </div>
                </div>
              )}

              <Fieldset title="Customer Information" step="01">
                <Field label="Full Name" required>
                  <input required value={form.name} onChange={(e) => update("name", e.target.value)} className={inputCls} placeholder="Your name" />
                </Field>
                <Field label="Mobile Number" required>
                  <input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputCls} placeholder="+91 9XXXX XXXXX" />
                </Field>
                <Field label="Email" required>
                  <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputCls} placeholder="you@example.com" />
                </Field>
              </Fieldset>

              {/* Only show product selection if NOT coming from cart */}
              {!hasCart && (
                <Fieldset title="Product Selection" step="02">
                  <Field label="What would you like?" full>
                    <ChipGroup options={productTypes} value={form.type} onChange={(v) => update("type", v)} />
                  </Field>
                  {(form.type === "Brownies" || form.type === "Brownie Cake") && (
                    <Field label="Flavour">
                      <select value={form.flavour} onChange={(e) => update("flavour", e.target.value)} className={inputCls}>
                        {flavoursList.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </Field>
                  )}
                  {form.type === "Brownie Cake" && (
                    <Field label="Weight">
                      <ChipGroup options={weights} value={form.weight} onChange={(v) => update("weight", v)} />
                    </Field>
                  )}
                  {form.type === "Brownies" && (
                    <Field label="Quantity">
                      <input value={form.browniePieces} onChange={(e) => update("browniePieces", e.target.value)} className={inputCls} placeholder="e.g. 12 pieces" />
                    </Field>
                  )}
                </Fieldset>
              )}

              <Fieldset title="Customisation" step={hasCart ? "02" : "03"}>
                <Field label="Cake Message" full>
                  <input value={form.message} onChange={(e) => update("message", e.target.value)} className={inputCls} placeholder="e.g. Happy Birthday, Aanya!" />
                </Field>
                <Field label="Theme / Special Request">
                  <input value={form.theme} onChange={(e) => update("theme", e.target.value)} className={inputCls} placeholder="Floral, minimal, gold accents…" />
                </Field>
              </Fieldset>

              <Fieldset title="Delivery" step={hasCart ? "03" : "04"}>
                <Field label="How will you receive it?" full>
                  <ChipGroup options={["Pickup", "Delivery"]} value={form.delivery} onChange={(v) => update("delivery", v as Delivery)} />
                </Field>
                {form.delivery === "Delivery" && (
                  <>
                    <Field label="Delivery Address" full>
                      <textarea required value={form.address} onChange={(e) => update("address", e.target.value)} className={`${inputCls} min-h-24`} placeholder="Full address, landmark, pincode" />
                    </Field>
                    <Field label="Delivery Pincode" full>
                      <input
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        value={form.pincode}
                        onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={inputCls}
                        placeholder="e.g. 411014"
                      />
                      <DeliveryEstimateCard estimate={estimate} pincode={form.pincode} />
                    </Field>
                  </>
                )}
                <Field label="Occasion">
                  <select value={form.occasion} onChange={(e) => update("occasion", e.target.value)} className={inputCls}>
                    {occasions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Date Required" required>
                  <input required type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Additional Notes" full>
                  <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className={`${inputCls} min-h-24`} placeholder="Allergies, decorations, anything else." />
                </Field>
              </Fieldset>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                <p className="text-xs text-muted-foreground">By submitting, you agree to be contacted for order confirmation.</p>
                <div className="flex flex-wrap gap-3">
                  <a href={`https://wa.me/918208257574?text=${waMessage}`} target="_blank" rel="noreferrer" className="btn-outline">
                    <MessageCircle className="h-4 w-4" /> Send on WhatsApp instead
                  </a>
                  <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
                    {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : "Submit Enquiry"}
                  </button>
                </div>
              </div>
            </form>
          </Reveal>

          <Reveal delay={150}>
            <aside className="sticky top-28 space-y-6">
              <div className="rounded-2xl border border-[color:var(--gold)]/30 bg-card p-7">
                <p className="eyebrow">What happens next</p>
                <ol className="mt-4 space-y-4 text-sm">
                  {[
                    "We receive your enquiry instantly.",
                    "You hear back with availability and pricing.",
                    "You confirm details and complete payment.",
                    "We bake fresh — and deliver or arrange pickup.",
                  ].map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--chocolate-dark)] text-[10px] text-[color:var(--cream)]">{i + 1}</span>
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-border bg-[color:var(--cream-dark)]/40 p-7">
                <p className="font-display text-xl">Need it sooner?</p>
                <p className="mt-2 text-sm text-muted-foreground">WhatsApp is the fastest way to reach us — we usually reply within an hour.</p>
                <a href="https://wa.me/918208257574" target="_blank" rel="noreferrer" className="btn-gold mt-5">WhatsApp Us</a>
              </div>
            </aside>
          </Reveal>
        </div>
      </section>
    </>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/30";

function Fieldset({ title, step, children }: { title: string; step: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-6 flex items-center gap-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--chocolate-dark)] text-xs text-[color:var(--cream)]">{step}</span>
        <span className="font-display text-2xl">{title}</span>
      </legend>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, full, required }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label} {required && <span className="text-[color:var(--gold)]">*</span>}
      </span>
      {children}
    </label>
  );
}

function ChipGroup<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`rounded-full border px-4 py-2 text-sm transition ${active ? "border-[color:var(--chocolate-dark)] bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]" : "border-border bg-background hover:border-[color:var(--gold)]"}`}
            aria-pressed={active}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function DeliveryEstimateCard({ estimate, pincode }: { estimate: ReturnType<typeof estimateDelivery>; pincode: string }) {
  if (!pincode) return null;
  const headerCls = "mt-4 rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--cream-dark)]/40 p-5";
  if (estimate.kind === "invalid") return <div className={headerCls}><p className="text-sm text-muted-foreground">Enter a valid 6-digit pincode to see an estimated delivery charge.</p></div>;
  if (estimate.kind === "unknown") return (
    <div className={headerCls}>
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[color:var(--gold)]" /><p className="eyebrow !mb-0">Estimated Delivery Charge</p></div>
      <p className="mt-3 font-display text-2xl">Contact for Quote</p>
      <p className="mt-2 text-xs text-muted-foreground">We don't have this pincode in our local zones yet — WhatsApp us to confirm.</p>
    </div>
  );
  if (estimate.kind === "quote") return (
    <div className={headerCls}>
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[color:var(--gold)]" /><p className="eyebrow !mb-0">Estimated Delivery Charge</p></div>
      <p className="mt-3 font-display text-2xl">Contact for Quote</p>
      <p className="mt-1 text-xs text-muted-foreground">~{estimate.km} km from Kharadi · {estimate.label}</p>
    </div>
  );
  return (
    <div className={headerCls}>
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[color:var(--gold)]" /><p className="eyebrow !mb-0">Estimated Delivery Charge</p></div>
      <p className="mt-3 font-display text-3xl text-[color:var(--chocolate-dark)]">{estimate.charge} <span className="text-sm font-normal text-muted-foreground">(Approx.)</span></p>
      <p className="mt-1 text-xs text-muted-foreground">~{estimate.km} km from Kharadi · {estimate.label}</p>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">* Final delivery charges may vary. This estimate is for reference only.</p>
    </div>
  );
}
