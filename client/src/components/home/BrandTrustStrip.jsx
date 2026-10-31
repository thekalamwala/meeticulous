/* Company trust strip — single auto-scrolling row of brand logos under the hero
   ("Used by people who work with"). Revived from the old About LogoMarquee
   (whose PNGs lived on the dead company-assets.meeticulous.in host).
   Logos are Simple Icons SVGs (via Iconify) filled with each brand's own colour;
   Google + Microsoft use the full-colour Iconify "logos" marks. Self-hosted in
   client/public/images/brands/. Icon-only marks get the brand name beside them;
   wordmarks (`wordmark: true`) stand alone — their SVG viewBoxes are cropped to
   the artwork so they don't render tiny.
   Uses the shared .sloth-marquee CSS (pauses on hover, static under
   prefers-reduced-motion). */

const BRANDS = [
  { name: "Mahindra", file: "mahindra" },
  { name: "Apple", file: "apple" },
  { name: "Flipkart", file: "flipkart" },
  { name: "Google", file: "google" },
  { name: "Zomato", file: "zomato", wordmark: true },
  { name: "Microsoft", file: "microsoft" },
  { name: "Swiggy", file: "swiggy" },
  { name: "Amazon", file: "amazon" },
  { name: "Paytm", file: "paytm", wordmark: true },
  { name: "Coca-Cola", file: "cocacola", wordmark: true },
  { name: "Nike", file: "nike" },
  { name: "Samsung", file: "samsung", wordmark: true },
  { name: "Netflix", file: "netflix" },
  { name: "Spotify", file: "spotify" },
];

const Brand = ({ item }) => (
  <li className="flex h-10 flex-shrink-0 items-center gap-2.5 px-6 sm:px-8">
    <img
      src={`/images/brands/${item.file}.svg`}
      alt=""
      width={item.wordmark ? undefined : 28}
      height={item.wordmark ? 24 : 28}
      loading="lazy"
      className={item.wordmark ? "h-6 w-auto max-w-[120px] object-contain" : "h-7 w-7 object-contain"}
    />
    {!item.wordmark && (
      <span className="whitespace-nowrap font-heading text-xl font-bold tracking-tight text-ink">{item.name}</span>
    )}
  </li>
);

export default function BrandTrustStrip() {
  return (
    <section className="border-b border-black/5 py-10 lg:py-12">
      <p className="mb-6 px-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-500 sm:px-8">
        Used by people who work with
      </p>

      {/* The scrolling row is a decorative repeat; screen readers get this list */}
      <ul className="sr-only">
        {BRANDS.map((b) => (
          <li key={b.name}>{b.name}</li>
        ))}
      </ul>
      <div aria-hidden className="sloth-marquee-wrap sloth-edge-fade overflow-hidden">
        <ul className="sloth-marquee sloth-marquee--left" style={{ animationDuration: "48s" }}>
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <Brand key={`${b.name}-${i}`} item={b} />
          ))}
        </ul>
      </div>
    </section>
  );
}
