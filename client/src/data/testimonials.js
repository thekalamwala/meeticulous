/**
 * Real-host testimonials — single source of truth for the homepage carousel
 * AND landing-page social proof. Quotes reflect each profession's use of
 * Meeticulous. Avatars are self-hosted in client/public/images/testimonials
 * (112px webp; were 256px JPGs on the .in CDN — PageSpeed image-delivery);
 * the TAvatar component falls back to initials if an image is missing.
 *
 * COMPLIANCE — endorsement/testimonial rules (FTC 16 CFR Part 255, ASCI code):
 * every entry here is published as a REAL named person's endorsement. Each one
 * must be a genuine quote from that host, kept only with their documented
 * consent to be used publicly. Do NOT add invented, composite, or
 * "placeholder" people to this list — fabricated endorsements are unlawful.
 * Before adding/keeping an entry, confirm the quote is real and consent is on
 * file; remove anyone who withdraws consent.
 */
export const TESTIMONIALS = [
  { quote: "Half my day used to go in 'is a cabin free at 4?' WhatsApps. Now people just book it themselves.", name: "Mukesh Tidke", role: "Coworking Space Owner", avatar: "/images/testimonials/mukesh-tidke.webp" },
  { quote: "Clients book site-visit slots straight off my link and pay upfront. No more chasing dates over WhatsApp.", name: "Ar. Pranav Kadoo", role: "Architect", avatar: "/images/testimonials/pranav-kadoo.webp" },
  { quote: "I send the link, they pick a slot, payment's sorted before the call. No more awkward money talk.", name: "Vishal Chaware", role: "Salesforce Developer", avatar: "/images/testimonials/vishal-chaware.webp" },
  { quote: "Set up my weekend mentoring in one evening and kind of forgot about it. Slots fill, money's already in.", name: "Sangharata Somkuvar", role: "DevOps Engineer", avatar: "/images/testimonials/sangharata-somkuvar.webp" },
  { quote: "My patients forget appointments easily. The reminder texts have honestly been a lifesaver.", name: "Dr. Yukta Bawankar", role: "Physiotherapist", avatar: "/images/testimonials/yukta-bawankar.webp" },
  { quote: "Stuck the link in my Insta bio. Looks way better than sending a GPay QR after the call.", name: "Happy Singh", role: "Creative Lead", avatar: "/images/testimonials/happy-singh.webp" },
  { quote: "Honestly I picked it because 0% commission. I charge for audits and Meeticulous doesn't take a cut.", name: "Arjun Ravikumar", role: "Performance Marketeer", avatar: "/images/testimonials/arjun-ravikumar.webp" },
  { quote: "I run mentoring calls on the side — slots fill, payment's sorted, zero admin after work hours.", name: "Tushar Malvi", role: "Management Trainee, ECL", avatar: "/images/testimonials/tushar-malvi.webp" },
];
