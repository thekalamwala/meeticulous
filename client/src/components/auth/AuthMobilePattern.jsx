// The pink "ee" ribbon from the homepage hero foot, reused along the bottom
// edge on mobile/tablet — where the brand panel (lg+ only) is hidden, so the
// auth card doesn't sit on a blank page. One per layout, behind content,
// bleeding off both side edges. Keep EE_PATH in sync with HomeHero.jsx.
const EE_PATH =
  "M-4000,130 L0,130 C40,130 70,128 95,110 C125,88 135,50 105,40 C70,30 40,75 45,120 " +
  "C50,175 95,195 140,170 C170,150 200,110 225,95 C255,72 265,40 235,35 " +
  "C200,30 172,75 178,120 C185,170 230,195 280,175 C320,160 360,150 400,150 L4000,150";

const AuthMobilePattern = () => (
  <svg
    aria-hidden
    viewBox="0 0 560 220"
    preserveAspectRatio="xMidYMax slice"
    className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 w-full overflow-hidden opacity-40 lg:hidden"
  >
    <path d={EE_PATH} fill="none" stroke="var(--mt-pink)" strokeWidth="20" strokeLinecap="butt" strokeLinejoin="round" />
  </svg>
);

export default AuthMobilePattern;
