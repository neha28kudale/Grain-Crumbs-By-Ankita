import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { flavours } from "@/lib/flavours";
import { Reveal } from "@/components/Reveal";
import { WHATSAPP_PLAIN_URL } from "@/lib/whatsapp";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";

export const Route = createFileRoute("/brownies")({
  head: () => ({
    meta: [
      { title: "Brownies — Grain Crumbs" },
      { name: "description", content: "Six signature millet brownie flavours, baked fresh in Pune. Made with jaggery and couverture chocolate." },
      { property: "og:title", content: "Brownies — Grain Crumbs" },
      { property: "og:description", content: "Explore our six signature millet brownie flavours." },
    ],
  }),
  component: BrowniesPage,
});

const photoTreatment = "h-full w-full object-cover saturate-[0.92] contrast-[1.05] brightness-[0.98]";

function BrowniesPage() {
  const { addItem } = useCart();
  const navigate = useNavigate();

  const handleAddToCart = (f: (typeof flavours)[number]) => {
    addItem({
      slug: f.slug,
      name: f.name,
      price: f.price,
      image: f.image,
    });
    toast.success(`${f.name} added to cart`, {
      action: {
        label: "View cart",
        onClick: () => navigate({ to: "/cart" }),
      },
    });
  };

  return (
    <>
      {/* HERO — collage style, inspired by brownie cakes page */}
      <section className="relative overflow-hidden border-b border-border/60 bg-[color:var(--cream-dark)]/40">
        <div className="container-prose relative grid items-center gap-10 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
          <Reveal>
            <p className="divider-gold eyebrow">Brownies</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] md:text-6xl">
              Brownies that taste like
              <span className="block italic text-[color:var(--chocolate)]">a little ceremony.</span>
            </h1>
            <p className="mt-6 max-w-xl text-muted-foreground">
              Six signature flavours, all built on our millet-and-jaggery base. Baked to order, hand-finished, and never mass produced — without a grain of maida.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/order" className="btn-primary">Order Brownies</Link>
              <a href={WHATSAPP_PLAIN_URL} target="_blank" rel="noreferrer" className="btn-outline">Chat on WhatsApp</a>
              <a href="#menu" className="btn-outline">View Menu &amp; Pricing</a>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative overflow-hidden rounded-[2rem] ring-1 ring-[color:var(--gold)]/25 shadow-[0_24px_60px_-28px_rgba(60,30,10,0.42)]">
              <img
                src="/assets/grain-crumbs/hero-premium.png"
                alt="Grain Crumbs signature millet brownies"
                width={1200}
                height={1500}
                className={`${photoTreatment} aspect-[4/5]`}
              />
            </div>
          </Reveal>

        </div>
      </section>

      {/* MENU — full pricing list, kept from before */}
      <section id="menu" className="section bg-[color:var(--cream-dark)]/40">
        <div className="container-prose">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Menu &amp; pricing</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">The signature six.</h2>
            <p className="mt-4 text-muted-foreground">All brownies are baked fresh to order in Pune. Minimum order quantities apply to filled flavours.</p>
          </Reveal>

          <div className="mt-14 grid gap-10">
            {flavours.map((f, i) => (
              <Reveal key={f.slug} delay={i * 50}>
                <article id={f.slug} className={`grid items-center gap-8 scroll-mt-24 md:grid-cols-2 ${i % 2 ? "md:[&>div:first-child]:order-2" : ""}`}>
                  <div className="relative overflow-hidden rounded-[2rem] ring-1 ring-[color:var(--gold)]/25 shadow-[0_24px_60px_-28px_rgba(60,30,10,0.38)]">
                    <img
                      src={f.image}
                      alt={f.name}
                      loading="lazy"
                      width={1024}
                      height={1280}
                      className={photoTreatment}
                    />
                  </div>
                  <div>
                    <p className="eyebrow">{`0${i + 1}`}</p>
                    <h3 className="mt-3 font-display text-4xl md:text-5xl">{f.name}</h3>
                    <div className="mt-3 flex flex-wrap items-baseline gap-3">
                      <p className="italic text-[color:var(--gold)]">{f.tagline}</p>
                      <span className="font-display text-2xl text-[color:var(--chocolate)]">₹{f.price}</span>
                    </div>
                    <p className="mt-5 max-w-md text-muted-foreground">{f.description}</p>
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {f.notes.map((n) => (
                        <li key={n} className="rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {n}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(f)}
                        className="btn-primary w-full sm:w-auto"
                      >
                        Add to cart
                      </button>
                      <Link to="/cart" className="btn-outline w-full sm:w-auto">View cart</Link>
                      <a href={WHATSAPP_PLAIN_URL} target="_blank" rel="noreferrer" className="btn-outline w-full sm:w-auto">Ask on WhatsApp</a>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
