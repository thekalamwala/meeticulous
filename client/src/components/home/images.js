/**
 * Centralized image placeholders for the homepage.
 * ───────────────────────────────────────────────────────────
 * All images are royalty-free Unsplash photos served via the
 * Unsplash CDN with on-the-fly crop + format params.
 *
 * TO REPLACE: swap the photo ID (the `photo-xxxxx` slug) below,
 * or point `u()` at your own CDN. Everything else stays.
 *
 * u(id, w, h) → cropped, auto-format, q80 URL.
 */
export const u = (id, w = 800, h = 1000) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;


// Hero "5/5" social-proof faces. Self-hosted from client/public.
// 80×80 webp (2× the 40px display) — was 128px PNG (PageSpeed image-delivery).
export const HERO_FACES = [
  "/images/hero/face-1.webp",
  "/images/hero/face-2.webp",
  "/images/hero/face-3.webp",
];

// "Who it's for" — Indian-looking professionals across roles
export const PERSONAS = {
  freelancer: u("1600880292203-757bb62b4baf", 900, 1100), // laptop creative
  tutor: u("1577896851231-70ef18881754", 900, 1100), // teaching
  coach: u("1559839734-2b71ea197ec2", 900, 1100), // coaching
  therapist: u("1594824476967-48c8b964273f", 900, 1100), // calm therapist
  consultant: u("1556157382-97eda2d62296", 900, 1100), // consultant
  studio: u("1522071820081-009f0129c71c", 900, 1100), // agency team
};

// Testimonial avatars (small, square). Displayed at 40px (h-10 w-10); 80px
// source = 2x retina. Larger wastes bytes — see PageSpeed image-delivery audit.
export const FACES = [
  u("1494790108377-be9c29b29330", 80, 80),
  u("1507003211169-0a1dd7228f2d", 80, 80),
  u("1438761681033-6461ffad8d80", 80, 80),
  u("1500648767791-00dcc994a43e", 80, 80),
  u("1534528741775-53994a69daeb", 80, 80),
  u("1517841905240-472988babdf9", 80, 80),
  u("1544005313-94ddf0286df2", 80, 80),
  u("1463453091185-61582044d556", 80, 80),
  u("1531123897727-8f129e1688ce", 80, 80),
  u("1489424731084-a5d8b219a5bb", 80, 80),
  u("1492562080023-ab3db95bfbce", 80, 80),
  u("1573496359142-b8d87734a5a2", 80, 80),
];

// Final CTA — wide calm lifestyle
export const FINAL = u("1499209974431-9dddcece7f88", 1600, 900);

// Newsletter illustration / calm scene
export const NEWSLETTER = u("1506126613408-eca07ce68773", 800, 600);
