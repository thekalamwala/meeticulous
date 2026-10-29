// Company ownership line, shared by the site Footer and every /for/* page footer.
// Visible site-wide — part of the Google OAuth verification checklist (homepage
// must identify the operator), so keep the full legal name in the text.
// "Timewheel Internet" is a dofollow backlink to Timewheel's web-development page.
export const TIMEWHEEL_URL = 'https://timewheel.co.in/web-development-company-in-nagpur';

// text-inherit: the global `a` rule paints links primary orange; match the footer text instead.
export default function OperatorCredit({ linkClassName = 'text-inherit underline underline-offset-2 hover:opacity-80' }) {
  return (
    <span>
      Operated and Hand crafted by the humans of{' '}
      <a href={TIMEWHEEL_URL} target="_blank" rel="noopener" className={linkClassName}>Timewheel Internet</a>{' '}
      Private Limited
    </span>
  );
}
