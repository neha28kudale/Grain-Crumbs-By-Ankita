import { createFileRoute } from "@tanstack/react-router";
import { Phone, MapPin, Instagram, Mail, MessageCircle, Clock } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { WHATSAPP_ORDER_URL, WHATSAPP_PLAIN_URL } from "@/lib/whatsapp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Grain Crumbs" },
      { name: "description", content: "Get in touch with Grain Crumbs. WhatsApp, call or visit us in Kharadi, Pune." },
      { property: "og:title", content: "Contact — Grain Crumbs" },
      { property: "og:description", content: "WhatsApp, call or visit us in Kharadi, Pune." },
    ],
  }),
  component: Page,
});

const channels = [
  { icon: MessageCircle, label: "WhatsApp", value: "+91 82082 57574", href: WHATSAPP_ORDER_URL, primary: true },
  { icon: Phone, label: "Call", value: "+91 82082 57574", href: "tel:+918208257574" },
  { icon: Instagram, label: "Instagram", value: "@graincrumbs", href: "https://instagram.com/graincrumbs" },
  { icon: Mail, label: "Email", value: "thegraincrumbs@gmail.com", href: "mailto:thegraincrumbs@gmail.com" },
  { icon: MapPin, label: "Visit", value: "Kharadi, Pune", href: "https://maps.google.com/?q=Kharadi+Pune" },
  { icon: Clock, label: "Hours", value: "Mon – Sat · 10am – 8pm", href: "#" },
];

function Page() {
  return (
    <>
      <section className="border-b border-border/60">
        <div className="container-prose py-20 text-center md:py-24">
          <p className="divider-gold eyebrow">Contact</p>
          <h1 className="mt-5 font-display text-5xl md:text-6xl">Say hello.</h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Order, customise, gift, or just ask. We're a small team — replies usually arrive
            within the hour.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-prose">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((c, i) => (
              <Reveal key={c.label} delay={i * 60}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className={`group block h-full rounded-2xl border p-7 transition-all ${
                    c.primary
                      ? "border-[color:var(--chocolate-dark)] bg-[color:var(--chocolate-dark)] text-[color:var(--cream)] hover:bg-[color:var(--chocolate)]"
                      : "card-warm"
                  }`}
                >
                  <div className={`grid h-11 w-11 place-items-center rounded-full ${c.primary ? "bg-[color:var(--gold)] text-[color:var(--chocolate-dark)]" : "bg-[color:var(--cream-dark)] text-[color:var(--chocolate)] ring-1 ring-[color:var(--gold)]/40"}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <p className={`mt-5 text-xs uppercase tracking-[0.25em] ${c.primary ? "text-[color:var(--gold-soft)]" : "text-muted-foreground"}`}>
                    {c.label}
                  </p>
                  <p className={`mt-2 font-display text-2xl ${c.primary ? "text-[color:var(--cream)]" : ""}`}>
                    {c.value}
                  </p>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="mt-16 text-center">
            <p className="text-muted-foreground">Ready to place an order?</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <a href={WHATSAPP_ORDER_URL} target="_blank" rel="noreferrer" className="btn-primary w-full sm:w-auto">Order on WhatsApp</a>
              <a href={WHATSAPP_PLAIN_URL} target="_blank" rel="noreferrer" className="btn-outline w-full sm:w-auto">Quick WhatsApp</a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
