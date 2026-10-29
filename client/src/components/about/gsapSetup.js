// Single registration point for GSAP on the About page.
// Import { gsap, ScrollTrigger, useGSAP } from here so plugins register exactly once.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// Shared premium easing — used across sections for a consistent "expensive" feel.
export const EASE = "power3.out";

export { gsap, ScrollTrigger, useGSAP };
