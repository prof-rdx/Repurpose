import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Layers,
  Mail,
  Twitter,
  Sparkles,
  Clock,
  Check,
  Play,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Repurpose — Turn one video into a week of content" },
      {
        name: "description",
        content:
          "Drop in a YouTube link or transcript. Get a blog post, LinkedIn carousel, email newsletter and Twitter threads in minutes.",
      },
      { property: "og:title", content: "Repurpose — Turn one video into a week of content" },
      { property: "og:description", content: "Turn long-form content into a week of marketing assets, automatically." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Repurpose",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Drop in a YouTube link or transcript. Get a blog post, LinkedIn carousel, email newsletter and Twitter threads in minutes.",
          offers: { "@type": "Offer", price: "29", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Landing,
});

const OUTPUTS = [
  { icon: FileText, title: "SEO blog post", desc: "1,000-word post with H2/H3 structure, intro, takeaways, conclusion.", tag: "Blog" },
  { icon: Layers, title: "LinkedIn carousel", desc: "Five slides: hook → three insights → CTA. Drop into Figma.", tag: "Slides" },
  { icon: Mail, title: "Email newsletter", desc: "Subject line + 250-word body in a voice that sounds like yours.", tag: "Email" },
  { icon: Twitter, title: "Three Twitter threads", desc: "Three angles, 5–8 tweets each, every tweet under 280 chars.", tag: "Social" },
] as const;

const STEPS = [
  { n: "01", t: "Drop your source", d: "Paste a YouTube URL or a raw transcript. No upload step." },
  { n: "02", t: "We find the arguments", d: "The model identifies the 3–5 core ideas and the story arc." },
  { n: "03", t: "Ship everywhere", d: "Copy each asset, tweak in two minutes, post wherever your audience lives." },
] as const;

const PLANS = [
  { name: "Starter", price: "$29", hours: "5 hours of video / month", cta: "Choose Starter" },
  { name: "Creator", price: "$59", hours: "15 hours of video / month", cta: "Choose Creator", featured: true },
  { name: "Studio", price: "$89", hours: "40 hours of video / month", cta: "Choose Studio" },
] as const;

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xl"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-glow"
              style={{ background: "var(--gradient-primary)" }}
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display">Repurpose</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#how" className="story-link hidden rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:inline-block">
              How it works
            </a>
            <a href="#pricing" className="story-link hidden rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:inline-block">
              Pricing
            </a>
            <Link to="/auth" className="hidden sm:inline-block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="shadow-glow transition-transform hover:scale-[1.03]">Get started</Button>
            </Link>
          </nav>

        </div>
      </header>

      <main id="main">
        {/* SPLIT-SCREEN HERO */}
        <section className="relative overflow-hidden border-b border-border/50">
          <div aria-hidden="true" className="absolute inset-0 bg-grid" />
          <div aria-hidden="true" className="absolute inset-0 bg-aurora opacity-80" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
            {/* LEFT — copy */}
            <div className="max-w-xl">
              <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="relative grid h-1.5 w-1.5 place-items-center rounded-full bg-accent">
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent" />
                </span>
                One source. Four polished outputs.
              </div>
              <h1 className="animate-fade-up stagger-1 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Transform once.
                <br />
                <span className="text-gradient">Publish everywhere.</span>
              </h1>
              <p className="animate-fade-up stagger-2 mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
                Drop a 1-hour webinar, podcast or YouTube link. Get an SEO blog post,
                a 5-slide LinkedIn carousel, an email newsletter and three Twitter threads —
                in under a minute.
              </p>
              <div className="animate-fade-up stagger-3 mt-8 flex flex-col items-start gap-3 sm:flex-row">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button size="lg" className="group w-full gap-2 shadow-glow transition-transform hover:scale-[1.02] sm:w-auto">
                    Repurpose your first video{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <a href="#how" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full gap-2 border-border/60 bg-card/40 backdrop-blur hover-lift sm:w-auto">
                    <Play className="h-4 w-4" /> See how it works
                  </Button>
                </a>
              </div>
              <p className="animate-fade-up stagger-4 mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Average run: 45 seconds for a 60-minute video
              </p>
            </div>

            {/* RIGHT — product mock */}
            <div className="relative animate-fade-up stagger-2">
              <div
                aria-hidden="true"
                className="animate-blob absolute -inset-6 -z-10 opacity-50 blur-3xl"
                style={{ background: "var(--gradient-primary)" }}
              />
              <div className="animate-float relative rounded-2xl border border-border/60 bg-card/80 p-3 shadow-elegant backdrop-blur-xl">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                  <span className="ml-3 truncate text-xs text-muted-foreground">repurpose.app / jobs / acme-q3-webinar</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm font-medium">Acme Q3 product webinar</div>
                      <div className="text-xs text-muted-foreground">youtu.be/dQw4w9WgXcQ · 58 min</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent ring-1 ring-inset ring-accent/30">
                      <Zap className="h-3 w-3" /> Done
                    </span>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {OUTPUTS.map((o, i) => (
                      <li
                        key={o.tag}
                        className={`group animate-fade-up stagger-${i + 2} rounded-lg border border-border/50 bg-card/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/20 transition-transform group-hover:scale-110">
                            <o.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{o.tag}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-1.5 w-full overflow-hidden rounded bg-muted/80">
                            <div className="shimmer h-full w-full rounded" />
                          </div>
                          <div className="h-1.5 w-4/5 rounded bg-muted/60" />
                          <div className="h-1.5 w-3/5 rounded bg-muted/40" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Outputs grid */}
        <section id="how" className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">What you get</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              One transcript.<br />Four ready-to-ship assets.
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OUTPUTS.map((c, i) => (
              <li
                key={c.title}
                className={`group animate-fade-up stagger-${i + 1} relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow`}
              >
                <div aria-hidden="true" className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span
                  className="mb-5 grid h-11 w-11 place-items-center rounded-xl text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: "var(--gradient-primary)" }}
                  aria-hidden="true"
                >
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mb-1.5 font-display text-lg font-semibold tracking-tight">{c.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
              </li>
            ))}
          </ul>

        </section>

        {/* Steps */}
        <section className="border-y border-border/50 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
            <div className="mb-14 max-w-2xl">
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">How it works</div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Three steps from raw recording to a week of content.
              </h2>
            </div>
            <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
              <div aria-hidden="true" className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
              {STEPS.map((s, i) => (
                <li key={s.n} className={`group animate-fade-up stagger-${i + 1} relative rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow`}>
                  <div className="mb-4 font-display text-4xl font-bold leading-none text-gradient transition-transform group-hover:scale-105">
                    {s.n}
                  </div>
                  <h3 className="mb-1.5 font-display text-xl font-semibold tracking-tight">{s.t}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>

          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">Pricing</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Simple, hours-based pricing
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
              Pay for the hours of content you process. Cancel anytime.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3 md:items-stretch">
            {PLANS.map((p, i) => {
              const featured = "featured" in p && p.featured;
              return (
                <li
                  key={p.name}
                  className={[
                    `animate-fade-up stagger-${i + 1} relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1`,
                    featured
                      ? "border-primary/50 bg-card shadow-glow md:-translate-y-2 md:hover:-translate-y-3"
                      : "border-border/60 bg-card/60 hover:border-primary/30 hover:shadow-glow",
                  ].join(" ")}
                >

                  {featured && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium text-primary-foreground shadow-glow"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      Most popular
                    </span>
                  )}
                  <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{p.name}</div>
                  <div className="mt-2 font-display text-5xl font-semibold tracking-tight">
                    {p.price}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-3 text-sm">{p.hours}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {["All 4 output formats", "Library & re-edit", "Cancel anytime"].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="mt-7 block">
                    <Button
                      className={["min-h-11 w-full", featured ? "shadow-glow" : ""].join(" ")}
                      variant={featured ? "default" : "outline"}
                    >
                      {p.cta}
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-md text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
              aria-hidden="true"
            >
              <Sparkles className="h-3 w-3" />
            </span>
            © {new Date().getFullYear()} Repurpose
          </div>
          <div className="font-display tracking-tight">Transform once. Publish everywhere.</div>
        </div>
      </footer>
    </div>
  );
}
