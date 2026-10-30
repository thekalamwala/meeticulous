import { Link } from "react-router-dom";
import { Download, Mail, Building2, MapPin } from "lucide-react";
import Seo from "../components/common/Seo";
import { SITE_URL, organizationJsonLd, breadcrumbJsonLd, ORG_SAME_AS } from "../utils/seo";

/**
 * /press — press kit. Boilerplate, fast facts (real legal entity + registered
 * office, sourced from /privacy), brand assets and a press contact. Organization
 * + BreadcrumbList JSON-LD. All facts are the company's own published details.
 */

const CANONICAL = `${SITE_URL}/press`;
const PRESS_EMAIL = "bolt@meeticulous.in";
const LOGO = "https://company-assets.meeticulous.in/images/brand/logo.png";

const FACTS = [
  ["Product", "Meeticulous — a booking link that gets India's professionals booked and paid"],
  ["Legal entity", "Timewheel Internet Private Limited (CIN U62012OD2026PTC052654)"],
  ["Founded", "2026"],
  ["Headquarters", "Jajpur, Odisha, India"],
  ["Category", "Appointment scheduling & payments (SaaS)"],
  ["Model", "0% commission on paid plans — a flat fee, not a cut of your earnings"],
  ["Payments", "UPI, cards, net banking & wallets via Razorpay; GST-ready invoices"],
];

const BOILERPLATE =
  "Meeticulous is an India-first booking and payments platform for people who sell their time — coaches, consultants, creators, clinicians and small studios. Clients discover a professional's page, pick a slot and pay upfront over UPI, and the professional gets automatic WhatsApp and email reminders, Google Calendar sync and GST-ready invoices in one link. Meeticulous charges 0% commission on paid plans, so professionals keep what they earn.";

const Press = () => (
  <div className="min-h-dvh bg-canvas text-ink">
    <Seo
      title="Press & Media Kit — Meeticulous"
      description="Meeticulous press kit: company boilerplate, fast facts, brand assets and media contact. India-first booking & payments platform for professionals, 0% commission."
      canonical={CANONICAL}
      jsonLd={[
        organizationJsonLd(),
        breadcrumbJsonLd({ items: [{ name: "Home", path: "/" }, { name: "Press", path: "/press" }] }),
      ]}
    />

    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>→</span> Press
      </nav>

      <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">Press &amp; media kit</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Everything you need to write about Meeticulous. For interviews, data or anything not here,
        email <a href={`mailto:${PRESS_EMAIL}`} className="text-primary hover:underline">{PRESS_EMAIL}</a>.
      </p>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold">Boilerplate</h2>
        <p className="mt-3 leading-relaxed text-neutral-700">{BOILERPLATE}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold">Fast facts</h2>
        <dl className="mt-4 divide-y divide-black/5 rounded-[16px] border border-black/10 bg-white">
          {FACTS.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:gap-6">
              <dt className="w-40 flex-shrink-0 text-sm font-semibold text-neutral-500">{k}</dt>
              <dd className="text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold">Brand assets</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 rounded-[16px] border border-black/10 bg-white p-5">
            <img src={LOGO} alt="Meeticulous logo" width={56} height={56} className="h-14 w-14 object-contain" loading="lazy" />
            <a href={LOGO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white hover:no-underline">
              <Download size={15} /> Logo (PNG)
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Please use the name <strong>Meeticulous</strong> (not "BookASloth" or "Book-a-Sloth") and the orange #960D32 as the accent.
        </p>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-black/10 bg-white p-5">
          <Building2 size={18} className="text-primary" />
          <h3 className="mt-2 font-heading text-sm font-bold">Company</h3>
          <p className="mt-1 text-sm text-neutral-600">Timewheel Internet Private Limited</p>
        </div>
        <div className="rounded-[14px] border border-black/10 bg-white p-5">
          <MapPin size={18} className="text-primary" />
          <h3 className="mt-2 font-heading text-sm font-bold">Registered office</h3>
          <p className="mt-1 text-sm text-neutral-600">Byasanagar, District Jajpur, Odisha – 755019, India</p>
        </div>
      </section>

      <section className="mt-10 rounded-[16px] border border-primary/20 bg-primary/5 p-6">
        <Mail size={18} className="text-primary" />
        <h2 className="mt-2 font-heading text-lg font-bold">Media contact</h2>
        <p className="mt-1 text-neutral-700">
          <a href={`mailto:${PRESS_EMAIL}`} className="text-primary hover:underline">{PRESS_EMAIL}</a>
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {ORG_SAME_AS.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-primary">
              {u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-neutral-500">
        See also <Link to="/stats" className="text-primary hover:underline">Meeticulous by the numbers</Link> and the{" "}
        <Link to="/about" className="text-primary hover:underline">about page</Link>.
      </p>
    </main>
  </div>
);

export default Press;
