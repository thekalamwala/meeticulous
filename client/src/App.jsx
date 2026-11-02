import { Suspense, useState, useMemo, useEffect } from 'react';
import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import ChromeContext from './context/ChromeContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import PageGuides, { GUIDES_IN_PAGE } from './components/common/PageGuides';
import DashboardLayout from './components/common/DashboardLayout';
import AdminLayout from './components/common/AdminLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import HostRoute from './components/common/HostRoute';
import GuestRoute from './components/common/GuestRoute';
import GuestLayout from './components/common/GuestLayout';
import AnalyticsBridge from './components/common/AnalyticsBridge';
import ConsentBanner from './components/common/ConsentBanner';
import ScrollToTop from './components/common/ScrollToTop';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import PetalSpinner from './components/common/PetalSpinner';
import { useAuth } from './context/AuthContext';
import { KycProvider } from './context/KycContext';
import { captureReferral } from './services/api';
import { captureAttribution } from './utils/attribution';
import lazyWithRetry from './utils/lazyWithRetry';

// lazyWithRetry wraps React.lazy: it retries transient chunk-fetch failures and,
// on a stale-chunk-after-deploy 404, does a one-shot full reload to pull the
// fresh build — instead of throwing an unrecoverable white screen.
const lazy = lazyWithRetry;

// Bottom-right floating circle: re-opens the cookie/consent banner. It replaced
// the Bolt (now Tithi) support-chat launcher site-wide (owner request 2026-10-31).
// Exception: the Help pages mount the Tithi widget in that same corner instead,
// because their "Chat with Tithi" card opens it via the 'bolt:open' event.
const CookieButton = lazy(() => import('./components/common/CookieButton'));
const BotWidget = lazy(() => import('./components/common/BotWidget'));
const HELP_PAGE = /^\/help(\/|$)/;
const OpeningTakeover = lazy(() => import('./components/opening/OpeningTakeover'));

// ── Route-level lazy loading ──────────────────────────────────────────────────
// Layout / guard components stay eager (always needed, small).
// Every page component is lazy — only downloaded when the route is visited.

// Public pages
const Home           = lazy(() => import('./pages/Home'));
// Pre-compaction homepage snapshot — parked at /_attic (hidden, noindex) so the
// sections cut from the live homepage stay reachable for future reuse.
const HomeArchive    = lazy(() => import('./pages/HomeArchive'));
const Login          = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const ErrorPage      = lazy(() => import('./pages/ErrorPage'));
const Offline        = lazy(() => import('./pages/Offline'));
const Help           = lazy(() => import('./pages/Help'));
const HelpDocs       = lazy(() => import('./pages/HelpDocs'));
const HelpDoc        = lazy(() => import('./pages/HelpDoc'));
const Support        = lazy(() => import('./pages/Support'));
const Contact        = lazy(() => import('./pages/Contact'));
const Privacy        = lazy(() => import('./pages/Privacy'));
const Terms          = lazy(() => import('./pages/Terms'));
const Refund         = lazy(() => import('./pages/Refund'));
const GuestTerms     = lazy(() => import('./pages/GuestTerms'));
const HostAgreement  = lazy(() => import('./pages/HostAgreement'));
const HostFees       = lazy(() => import('./pages/HostFees'));
const EarningsCalculator = lazy(() => import('./pages/EarningsCalculator'));
const ToolsIndex = lazy(() => import('./pages/tools/ToolsIndex'));
const TemplatesIndex = lazy(() => import('./pages/TemplatesIndex'));
const NoShowCalculator = lazy(() => import('./pages/tools/NoShowCalculator'));
const GstCalculator = lazy(() => import('./pages/tools/GstCalculator'));
const Glossary = lazy(() => import('./pages/Glossary'));
const GlossaryTerm = lazy(() => import('./pages/GlossaryTerm'));
const Press = lazy(() => import('./pages/Press'));
const Stats = lazy(() => import('./pages/Stats'));
const Unsubscribe    = lazy(() => import('./pages/Unsubscribe'));
const About          = lazy(() => import('./pages/About'));
const Careers        = lazy(() => import('./pages/Careers'));
const JobDetail      = lazy(() => import('./pages/JobDetail'));
const Enterprise     = lazy(() => import('./pages/Enterprise'));
const HowItWorks     = lazy(() => import('./pages/HowItWorks'));
// SEO discovery hubs — crawlable directories that internally link every
// /for/* profession page (Solutions) and /compare/* competitor page (Compare).
const Solutions      = lazy(() => import('./pages/Solutions'));
const Compare        = lazy(() => import('./pages/Compare'));

// Competitor comparison pages (/compare/*, formerly /lp/*). Pages not yet rebuilt
// still draw their own header/footer and call useHideChrome() to drop the global nav.
const TopmateVsMeeticulous = lazy(() => import('./pages/compare/TopmateVsMeeticulous'));
const CalendlyAlternative  = lazy(() => import('./pages/compare/CalendlyAlternative'));
const SetmoreAlternative   = lazy(() => import('./pages/compare/SetmoreAlternative'));
const AcuityAlternative    = lazy(() => import('./pages/compare/AcuityAlternative'));
const SimplybookAlternative = lazy(() => import('./pages/compare/SimplybookAlternative'));
const ZohoBookingsAlternative = lazy(() => import('./pages/compare/ZohoBookingsAlternative'));

// Vendor Google auth (Google-only signup/login)
const BecomeAHost    = lazy(() => import('./pages/BecomeAHost'));
const InviteLanding  = lazy(() => import('./pages/InviteLanding'));
const HostLogin      = lazy(() => import('./pages/HostLogin'));
const Changelog      = lazy(() => import('./pages/Changelog'));
const Pricing        = lazy(() => import('./pages/Pricing'));
const AppointmentBookingSoftware = lazy(() => import('./pages/AppointmentBookingSoftware'));
const Blog           = lazy(() => import('./pages/Blog'));
const Search         = lazy(() => import('./pages/Search'));
const WallOfLove     = lazy(() => import('./pages/WallOfLove'));
const Opening        = lazy(() => import('./pages/Opening'));
const Inaugurators   = lazy(() => import('./pages/Inaugurators'));
const BlogPost       = lazy(() => import('./pages/BlogPost'));
const Moments        = lazy(() => import('./pages/Moments'));
const MomentPage     = lazy(() => import('./pages/MomentPage'));
const OgCard         = lazy(() => import('./pages/OgCard'));
const HostOgCard     = lazy(() => import('./pages/HostOgCard'));
const ServiceOgCard  = lazy(() => import('./pages/ServiceOgCard'));
const GoogleAuthDone = lazy(() => import('./pages/GoogleAuthDone'));

// Vendor Onboarding (Google-first 7-step flow)
const GoogleStart     = lazy(() => import('./pages/onboarding/GoogleStart'));
const PageStep        = lazy(() => import('./pages/onboarding/PageStep'));
const ServiceStep     = lazy(() => import('./pages/onboarding/ServiceStep'));
const PlansStep       = lazy(() => import('./pages/onboarding/PlansStep'));
const LiveStep        = lazy(() => import('./pages/onboarding/LiveStep'));

// Admin login
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

// Vendor dashboard
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Bookings    = lazy(() => import('./pages/Bookings'));
const Earnings    = lazy(() => import('./pages/Earnings'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Availability = lazy(() => import('./pages/Availability'));
const Products    = lazy(() => import('./pages/Products'));
const UpgradePlan = lazy(() => import('./pages/UpgradePlan'));
const Payouts     = lazy(() => import('./pages/Payouts'));
const ChatPage    = lazy(() => import('./pages/ChatPage'));
const ReferEarn   = lazy(() => import('./pages/ReferEarn'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Invoices     = lazy(() => import('./pages/Invoices'));
const Feedback     = lazy(() => import('./pages/Feedback'));

// Studio Client CRM ("Host 360") — Studio+ only, gated server-side.
const ClientsList  = lazy(() => import('./pages/ClientsList'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));

// KYC (host identity verification)
const KycHome      = lazy(() => import('./pages/kyc/KycHome'));
const KycFlow      = lazy(() => import('./pages/kyc/KycFlow'));
const KycStart     = lazy(() => import('./pages/kyc/KycStart'));
const KycBank      = lazy(() => import('./pages/kyc/KycBank'));
const KycAddress   = lazy(() => import('./pages/kyc/KycAddress'));
const KycSubmitted = lazy(() => import('./pages/kyc/KycSubmitted'));

// Service Module v2
const ServicesList = lazy(() => import('./pages/services/ServicesList'));
const AddService   = lazy(() => import('./pages/services/AddService'));
const EditService  = lazy(() => import('./pages/services/EditService'));

// Customer (guest) pages
const GuestOverview    = lazy(() => import('./pages/GuestOverview'));
const GuestInvoices    = lazy(() => import('./pages/GuestInvoices'));
const CustomerBookings = lazy(() => import('./pages/CustomerBookings'));
const CustomerProfile  = lazy(() => import('./pages/CustomerProfile'));
const CustomerReviews  = lazy(() => import('./pages/CustomerReviews'));
const ReviewPage       = lazy(() => import('./pages/ReviewPage'));
const ManageBooking    = lazy(() => import('./pages/ManageBooking'));
const Loyalty          = lazy(() => import('./pages/Loyalty'));

// Public host / service pages
const HostProfile     = lazy(() => import('./pages/HostProfile'));
const ServiceBooking  = lazy(() => import('./pages/ServiceBooking'));
const ServiceDetail   = lazy(() => import('./pages/ServiceDetail'));
const ProductPurchase = lazy(() => import('./pages/ProductPurchase'));

// Admin — Dashboard
const SuperDashboard = lazy(() => import('./pages/admin/SuperDashboard'));

// Admin — Core
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const AdminServices = lazy(() => import('./pages/admin/AdminServices'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPaymentSettings = lazy(() => import('./pages/admin/AdminPaymentSettings'));

// Admin — People
const AdminProviders = lazy(() => import('./pages/admin/AdminProviders'));
const AdminKYC       = lazy(() => import('./pages/admin/AdminKYC'));
const AdminKycOverview = lazy(() => import('./pages/admin/AdminKycOverview'));
const Host360List    = lazy(() => import('./pages/admin/Host360List'));
const AdminActivation = lazy(() => import('./pages/admin/AdminActivation'));
const Host360Detail  = lazy(() => import('./pages/admin/Host360Detail'));
const Guest360List   = lazy(() => import('./pages/admin/Guest360List'));
const Guest360Detail = lazy(() => import('./pages/admin/Guest360Detail'));

// Admin — Finance
const AdminTransactions = lazy(() => import('./pages/admin/AdminTransactions'));
const AdminPayouts      = lazy(() => import('./pages/admin/AdminPayouts'));
const AdminRefunds      = lazy(() => import('./pages/admin/AdminRefunds'));

// Admin — Content
const AdminPages        = lazy(() => import('./pages/admin/AdminPages'));
const AdminBlogs        = lazy(() => import('./pages/admin/AdminBlogs'));
const AdminNewsletter   = lazy(() => import('./pages/admin/AdminNewsletter'));
const AdminFAQ          = lazy(() => import('./pages/admin/AdminFAQ'));
const AdminTestimonials = lazy(() => import('./pages/admin/AdminTestimonials'));

// Admin — Support
const AdminTickets   = lazy(() => import('./pages/admin/AdminTickets'));
const AdminDisputes  = lazy(() => import('./pages/admin/AdminDisputes'));
const AdminReviews   = lazy(() => import('./pages/admin/AdminReviews'));
const AdminFeedback  = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminBotSupport = lazy(() => import('./pages/admin/AdminBotSupport'));
const AdminSupportChat = lazy(() => import('./pages/admin/AdminSupportChat'));
const SupportInsights = lazy(() => import('./pages/admin/SupportInsights'));

// Admin — Platform
const AdminAppearance    = lazy(() => import('./pages/admin/AdminAppearance'));
const AdminMenuBuilder   = lazy(() => import('./pages/admin/AdminMenuBuilder'));
const AdminFooterBuilder = lazy(() => import('./pages/admin/AdminFooterBuilder'));
const AdminCommunication = lazy(() => import('./pages/admin/AdminCommunication'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminCampaigns     = lazy(() => import('./pages/admin/AdminCampaigns'));
const AdminBadges        = lazy(() => import('./pages/admin/AdminBadges'));
const BadgeShowcase      = lazy(() => import('./pages/BadgeShowcase'));
const Explore         = lazy(() => import('./pages/Explore'));
const ServicesDirectory  = lazy(() => import('./pages/services/ServicesDirectory'));
const ProfessionServices = lazy(() => import('./pages/services/ProfessionServices'));
const ProfessionLanding  = lazy(() => import('./pages/for/ProfessionLanding'));
const Astrologers        = lazy(() => import('./pages/for/Astrologers'));
const ArchitectPage      = lazy(() => import('./pages/for/ArchitectPage'));
const DentistPage        = lazy(() => import('./pages/for/DentistPage'));
const CharteredAccountants = lazy(() => import('./pages/for/CharteredAccountants'));
const SportsTurf         = lazy(() => import('./pages/for/SportsTurf'));
const LawyersPage        = lazy(() => import('./pages/for/LawyersPage'));
const Pediatricians      = lazy(() => import('./pages/for/Pediatricians'));
const Gynecologists      = lazy(() => import('./pages/for/Gynecologists'));
const Dermatologists     = lazy(() => import('./pages/for/Dermatologists'));
const GeneralPhysicians  = lazy(() => import('./pages/for/GeneralPhysicians'));
const Physiotherapists   = lazy(() => import('./pages/for/Physiotherapists'));
const BusinessConsultants = lazy(() => import('./pages/for/BusinessConsultants'));
const EntSpecialists     = lazy(() => import('./pages/for/EntSpecialists'));
const Ophthalmologists   = lazy(() => import('./pages/for/Ophthalmologists'));
const Nutritionists      = lazy(() => import('./pages/for/Nutritionists'));
const LifeCoaches        = lazy(() => import('./pages/for/LifeCoaches'));
const Spas               = lazy(() => import('./pages/for/Spas'));
const SalonPage          = lazy(() => import('./pages/for/SalonPage'));
const Veterinarians      = lazy(() => import('./pages/for/Veterinarians'));
const FeaturePage = lazy(() => import('./pages/features/FeaturePage'));
const PaymentsFeature = lazy(() => import('./pages/features/PaymentsFeature'));
const SchedulingFeature       = lazy(() => import('./pages/features/SchedulingFeature'));
const BookingPagesFeature     = lazy(() => import('./pages/features/BookingPagesFeature'));
const AvailabilityFeature     = lazy(() => import('./pages/features/AvailabilityFeature'));
const GoogleCalendarFeature   = lazy(() => import('./pages/features/GoogleCalendarFeature'));
const NotificationsFeature    = lazy(() => import('./pages/features/NotificationsFeature'));
const ClientManagementFeature = lazy(() => import('./pages/features/ClientManagementFeature'));
const DigitalProductsFeature  = lazy(() => import('./pages/features/DigitalProductsFeature'));
const ReviewsFeature          = lazy(() => import('./pages/features/ReviewsFeature'));
const AnalyticsFeature        = lazy(() => import('./pages/features/AnalyticsFeature'));

// Admin — Operations
const AdminPlans  = lazy(() => import('./pages/admin/AdminPlans'));
const AdminAddons = lazy(() => import('./pages/admin/AdminAddons'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminServiceCategories = lazy(() => import('./pages/admin/AdminServiceCategories'));
const AdminExplore    = lazy(() => import('./pages/admin/AdminExplore'));

// Admin — System (M1: RBAC foundation)
const AdminStaff = lazy(() => import('./pages/admin/AdminStaff'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'));
const AdminReservedSlugs = lazy(() => import('./pages/admin/AdminReservedSlugs'));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals'));
const AdminInviteLinks = lazy(() => import('./pages/admin/AdminInviteLinks'));
const AdminBlockedIps = lazy(() => import('./pages/admin/AdminBlockedIps'));

// Admin — Platform Control
const AdminFeatureStatus = lazy(() => import('./pages/admin/AdminFeatureStatus'));

// Admin — Sales CRM command center
const SalesDesk       = lazy(() => import('./pages/admin/sales/SalesDesk'));
const RelationshipDesk = lazy(() => import('./pages/admin/sales/RelationshipDesk'));
const SalesLeads      = lazy(() => import('./pages/admin/sales/SalesLeads'));
const SalesLists      = lazy(() => import('./pages/admin/sales/SalesLists'));
const SalesLeadDetail = lazy(() => import('./pages/admin/sales/SalesLeadDetail'));
const SalesFollowUps  = lazy(() => import('./pages/admin/sales/SalesFollowUps'));
const SalesPipeline   = lazy(() => import('./pages/admin/sales/SalesPipeline'));
const SalesReports    = lazy(() => import('./pages/admin/sales/SalesReports'));
const CustomerDetail  = lazy(() => import('./pages/admin/sales/CustomerDetail'));
const SalesTemplates  = lazy(() => import('./pages/admin/sales/SalesTemplates'));
const ColdCallingLayout = lazy(() => import('./pages/admin/sales/ColdCallingLayout'));
const ColdCallOverview = lazy(() => import('./pages/admin/sales/ColdCallOverview'));
const ColdCallFollowUps = lazy(() => import('./pages/admin/sales/ColdCallFollowUps'));
const ColdCallHistory = lazy(() => import('./pages/admin/sales/ColdCallHistory'));
const ColdCallLists = lazy(() => import('./pages/admin/sales/ColdCallLists'));
const ColdCallReports = lazy(() => import('./pages/admin/sales/ColdCallReports'));
const ColdCallToday = lazy(() => import('./pages/admin/sales/ColdCallToday'));
const ColdCallLead = lazy(() => import('./pages/admin/sales/ColdCallLead'));
const SalesSequences  = lazy(() => import('./pages/admin/sales/SalesSequences'));

// Admin — Finance (P1: double-entry ledger)
const AdminFinanceDashboard = lazy(() => import('./pages/admin/AdminFinanceDashboard'));
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal'));
const AdminLedger  = lazy(() => import('./pages/admin/AdminLedger'));
// Admin — GST command center (P2 UI)
const AdminGstOverview     = lazy(() => import('./pages/admin/AdminGstOverview'));
const AdminGstTransactions = lazy(() => import('./pages/admin/AdminGstTransactions'));
const AdminGstInvoices     = lazy(() => import('./pages/admin/AdminGstInvoices'));
const AdminGstIssues       = lazy(() => import('./pages/admin/AdminGstIssues'));
const AdminGstReconciliation = lazy(() => import('./pages/admin/AdminGstReconciliation'));
const AdminGstItc          = lazy(() => import('./pages/admin/AdminGstItc'));
const AdminGstReturns      = lazy(() => import('./pages/admin/AdminGstReturns'));
const AdminGstReports      = lazy(() => import('./pages/admin/AdminGstReports'));
const AdminGstSettings     = lazy(() => import('./pages/admin/AdminGstSettings'));
const AdminGstExports      = lazy(() => import('./pages/admin/AdminGstExports'));
// Admin — SEO audit dashboard
const AdminSeo = lazy(() => import('./pages/admin/AdminSeo'));
const Presentation = lazy(() => import('./pages/presentation/Presentation'));
const PitchDeck = lazy(() => import('./pages/pitch-deck/PitchDeck'));

// ── Fallback shown while a route chunk downloads ──────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <PetalSpinner size={48} />
  </div>
);

// Refer & Earn attribution: a host who arrived via ?ref=<username> had it stashed
// in localStorage (AuthContext). Once they're an authed host, POST it once — the
// server write-once-guards, so re-fires are harmless — then clear it.
function useReferralCapture() {
  const { user } = useAuth();
  useEffect(() => {
    const ref = localStorage.getItem('bas_ref');
    if (!ref || !user?.is_host) return;
    captureReferral({ ref }).catch(() => {}).finally(() => localStorage.removeItem('bas_ref'));
  }, [user?.is_host]);
}

function DashboardWrapper({ children }) {
  useReferralCapture();
  return <HostRoute><DashboardLayout>{children}</DashboardLayout></HostRoute>;
}

// SECURITY: AdminWrapper does NOT use ProtectedRoute (which checks vendor/user session).
// AdminLayout has its own isolated guard that checks the 'bas_admin' session only.
// A vendor/user with no admin session is redirected to /backstage, not /login.
function AdminWrapper({ children }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function BookingRedirect() {
  const { profileSlug } = useParams();
  return <Navigate to={`/${profileSlug}`} replace />;
}

// /blogs/* is a common mistype of the canonical /blog/* — keep the link alive.
// In production Vercel 301s these before the app ever loads (client/vercel.json);
// this covers what that cannot — local dev, and in-app <Link> navigation, which
// never reaches the server. Both are needed.
function BlogsRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/blog/${slug}` : '/blog'} replace />;
}

// A logged-in host landing on "/" wants their dashboard, not the marketing
// homepage. Guests still get Home (they book from it). Prerender/crawlers have
// no session → user is null → Home renders normally, so SEO is untouched.
function HomeGate() {
  const { user, mode } = useAuth();
  const isHost = user?.is_host === true || user?.role === 'host' || user?.role === 'superadmin';
  if (isHost) {
    // Dual-capability account respects its last-used mode (the profile-page
    // switch). superadmin has is_host=false (trigger-forced) so it always lands
    // in the host space, never bounced to guest.
    const goGuest = user?.is_host === true && mode === 'traveling';
    return <Navigate to={goGuest ? '/user' : '/dashboard'} replace />;
  }
  return <Home />;
}

function App() {
  const location = useLocation();
  const { user } = useAuth();

  // Snapshot marketing attribution (UTM/referrer/landing) on first arrival, once,
  // before any signup/newsletter/enterprise call reads it (CRM Phase 2b).
  useEffect(() => { captureAttribution(); }, []);

  // Full-bleed pages (error / offline) flip this on via ChromeContext so the
  // global Navbar + Footer drop — even the catch-all 404, whose URL is unknown
  // ahead of time and so can't be matched by a pathname prefix.
  const [chromeHidden, setChromeHidden] = useState(false);
  // 'default' → normal footer rules; 'minimal' → a not-found error state asked
  // for the stripped footer, forced on even when it would normally be hidden.
  const [footerMode, setFooterMode] = useState('default');
  const chromeValue = useMemo(() => ({ setChromeHidden, setFooterMode }), []);

  const hideNavbar =
    chromeHidden ||
    location.pathname.startsWith('/dashboard') ||
    // Guest console (/user/*) ships its own sidebar shell + topbar (GuestLayout),
    // so the global navbar must not also render — otherwise two headers stack and
    // the guest sees two identity blocks (account name vs booking name).
    location.pathname.startsWith('/user') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/super-dashboard') ||
    location.pathname.startsWith('/vendor-register') ||
    location.pathname.startsWith('/lp') ||
    location.pathname.startsWith('/for/') ||
    location.pathname === '/become-a-host' ||
    location.pathname === '/opening' ||
    location.pathname === '/backstage';

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/login-as-vendor' ||
    location.pathname === '/become-a-host';

  // Guest booking page (/:profileSlug/booking/:serviceSlug) gets a stripped-down
  // footer — CTA band + legal bar only, no link columns — so checkout stays focused.
  const isBookingPage = /^\/[^/]+\/booking\/[^/]+\/?$/.test(location.pathname);

  const hideFooter = (hideNavbar || !!user || isAuthPage) && !isBookingPage;

  // Support bot rides along on public + host surfaces, but not admin, onboarding,
  // auth, or the stripped error/offline chrome.
  const hideBot =
    chromeHidden ||
    isAuthPage ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/super-dashboard') ||
    location.pathname.startsWith('/vendor-register') ||
    location.pathname === '/backstage';

  return (
    <ChromeContext.Provider value={chromeValue}>
      <ScrollToTop />
      <Toaster position="top-right" />
      {/* Boundary wraps the whole chrome, not just <Routes>: a throw in Navbar,
          ConsentBanner or AnalyticsBridge is ABOVE the route content and would
          otherwise unmount the entire tree into a blank white screen. resetKey
          clears the error when the user navigates to a different path. */}
      <RouteErrorBoundary resetKey={location.pathname}>
      <AnalyticsBridge />
      {/* Keep error / offline pages a clean single card — consent is still
          surfaced on every normal page. */}
      {!chromeHidden && (
        <ConsentBanner variant={location.pathname.startsWith('/lp') ? 'slim' : 'full'} />
      )}
      {!hideNavbar && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomeGate />} />
          {/* Competitor comparison pages — live under the /compare hub. */}
          <Route path="/compare/topmate-alternative" element={<TopmateVsMeeticulous />} />
          <Route path="/compare/calendly-alternative" element={<CalendlyAlternative />} />
          <Route path="/compare/setmore-alternative" element={<SetmoreAlternative />} />
          <Route path="/compare/acuity-alternative" element={<AcuityAlternative />} />
          <Route path="/compare/simplybook-alternative" element={<SimplybookAlternative />} />
          <Route path="/compare/zoho-bookings-alternative" element={<ZohoBookingsAlternative />} />
          {/* Old /lp/* URLs (Oct 2026 move). vercel.json 301s them at the edge;
              these cover in-app navigation from a stale link or cached bundle. */}
          {['calendly', 'setmore', 'acuity', 'simplybook', 'zoho-bookings'].map((c) => (
            <Route key={c} path={`/lp/${c}-alternative`} element={<Navigate to={`/compare/${c}-alternative`} replace />} />
          ))}
          <Route path="/lp/*" element={<Navigate to="/compare" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite/:slug" element={<InviteLanding />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/docs" element={<HelpDocs />} />
          <Route path="/help/docs/:slug" element={<HelpDoc />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/appointment-booking-software" element={<AppointmentBookingSoftware />} />
          <Route path="/search" element={<Search />} />
          <Route path="/wall-of-love" element={<WallOfLove />} />
          <Route path="/opening" element={<Opening />} />
          <Route path="/inaugurators" element={<Inaugurators />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/moments" element={<Moments />} />
          <Route path="/moments/:slug" element={<MomentPage />} />
          {/* Render target for the OG card generator, not a page for humans.
              noindex + absent from the sitemap and prerender lists. */}
          <Route path="/og/blog/:slug" element={<OgCard />} />
          <Route path="/og/host/:username" element={<HostOgCard />} />
          <Route path="/og/service/:username/:slug" element={<ServiceOgCard />} />
          <Route path="/blogs" element={<BlogsRedirect />} />
          <Route path="/blogs/:slug" element={<BlogsRedirect />} />
          <Route path="/about" element={<About />} />
          {/* SEO discovery hubs — link every profession + competitor landing page */}
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/careers/:jobSlug" element={<JobDetail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/guest-terms" element={<GuestTerms />} />
          <Route path="/host-agreement" element={<HostAgreement />} />
          <Route path="/host-fees" element={<HostFees />} />
          <Route path="/earnings-calculator" element={<EarningsCalculator />} />
          <Route path="/tools" element={<ToolsIndex />} />
          <Route path="/templates" element={<TemplatesIndex />} />
          <Route path="/tools/no-show-cost-calculator" element={<NoShowCalculator />} />
          <Route path="/tools/gst-calculator" element={<GstCalculator />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/glossary/:slug" element={<GlossaryTerm />} />
          <Route path="/press" element={<Press />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          {/* Customers never register — accounts are created automatically
              during booking (phone OTP). Old signup URL redirects home. */}
          <Route path="/signup" element={<Navigate to="/" replace />} />
          {/* #534: email/password host signup retired — hosts use Google at /become-a-host. */}
          <Route path="/vendor/signup" element={<Navigate to="/become-a-host" replace />} />

          {/* Host signup — Google-only */}
          <Route path="/become-a-host" element={<BecomeAHost />} />
          {/* Host login door (Google-only) — also the Google-callback error target. */}
          <Route path="/login-as-vendor" element={<HostLogin />} />
          <Route path="/auth/google/done" element={<GoogleAuthDone />} />

          {/* Vendor Onboarding (Google-first flow):
              claim → category (persona) → preview → live. The plan screen is a
              resume/upgrade safety net, not a forced step (paywall deferred to
              the dashboard). About + WhatsApp were folded into PreviewStep. */}
          <Route path="/vendor-register" element={<GoogleStart />} />
          {/* 3-screen flow: Your page → First service → Live. /claim, /category and
              /category/all all render PageStep so old resume links keep working. */}
          <Route path="/vendor-register/:slug/claim"    element={<PageStep />} />
          <Route path="/vendor-register/:slug/category" element={<PageStep />} />
          <Route path="/vendor-register/:slug/category/all" element={<PageStep />} />
          <Route path="/vendor-register/:slug/preview" element={<ServiceStep />} />
          <Route path="/vendor-register/:slug/plan"     element={<PlansStep />} />
          <Route path="/vendor-register/:slug/live"     element={<LiveStep />} />

          {/* Admin login (Backstage). */}
          <Route path="/backstage" element={<AdminLogin />} />

          {/* Vendor dashboard */}
          <Route path="/dashboard" element={<DashboardWrapper><Dashboard /></DashboardWrapper>} />
          <Route path="/dashboard/bookings" element={<DashboardWrapper><Bookings /></DashboardWrapper>} />
          <Route path="/dashboard/clients" element={<DashboardWrapper><ClientsList /></DashboardWrapper>} />
          <Route path="/dashboard/clients/:id" element={<DashboardWrapper><ClientDetail /></DashboardWrapper>} />
          <Route path="/dashboard/earnings" element={<DashboardWrapper><Earnings /></DashboardWrapper>} />
          <Route path="/dashboard/services" element={<DashboardWrapper><ServicesList /></DashboardWrapper>} />
          <Route path="/dashboard/service/add-new" element={<DashboardWrapper><AddService /></DashboardWrapper>} />
          <Route path="/dashboard/service/edit/:id" element={<DashboardWrapper><EditService /></DashboardWrapper>} />
          <Route path="/dashboard/service/view/:id" element={<DashboardWrapper><EditService /></DashboardWrapper>} />
          <Route path="/dashboard/availability" element={<DashboardWrapper><Availability /></DashboardWrapper>} />
          <Route path="/dashboard/profile" element={<DashboardWrapper><ProfileSetup /></DashboardWrapper>} />
          <Route path="/dashboard/kyc" element={<DashboardWrapper><KycHome /></DashboardWrapper>} />
          {/* KycProvider sits OUTSIDE DashboardWrapper on purpose: DashboardLayout
              renders pages inside PageTransition (keyed on pathname), so a provider
              below it would remount — and lose every field — on each step. */}
          <Route path="/dashboard/kyc/flow" element={<KycProvider><DashboardWrapper><KycFlow /></DashboardWrapper></KycProvider>}>
            <Route index element={<Navigate to="start" replace />} />
            <Route path="start" element={<KycStart />} />
            <Route path="bank" element={<KycBank />} />
            <Route path="address" element={<KycAddress />} />
            <Route path="submitted" element={<KycSubmitted />} />
          </Route>
          <Route path="/dashboard/products" element={<DashboardWrapper><Products /></DashboardWrapper>} />
          <Route path="/dashboard/upgrade" element={<DashboardWrapper><UpgradePlan /></DashboardWrapper>} />
          <Route path="/dashboard/payments/payouts" element={<DashboardWrapper><Payouts /></DashboardWrapper>} />
          <Route path="/dashboard/referrals" element={<DashboardWrapper><ReferEarn /></DashboardWrapper>} />
          <Route path="/dashboard/payments/transactions" element={<DashboardWrapper><Transactions /></DashboardWrapper>} />
          <Route path="/dashboard/invoices" element={<DashboardWrapper><Invoices /></DashboardWrapper>} />
          <Route path="/dashboard/feedback" element={<DashboardWrapper><Feedback /></DashboardWrapper>} />
          <Route path="/dashboard/chat" element={<DashboardWrapper><ChatPage /></DashboardWrapper>} />

          {/* Super Dashboard (main admin entry) */}
          <Route path="/super-dashboard" element={<AdminWrapper><SuperDashboard /></AdminWrapper>} />
          <Route path="/super-dashboard/:view" element={<AdminWrapper><SuperDashboard /></AdminWrapper>} />

          {/* Legacy /admin root -> redirect */}
          <Route path="/admin" element={<Navigate to="/super-dashboard" replace />} />

          {/* Operations — Bookings */}
          <Route path="/admin/activation" element={<AdminWrapper><AdminActivation /></AdminWrapper>} />
          <Route path="/admin/bookings" element={<AdminWrapper><AdminBookings /></AdminWrapper>} />
          <Route path="/admin/bookings/:filter" element={<AdminWrapper><AdminBookings /></AdminWrapper>} />

          {/* Operations — Services */}
          <Route path="/admin/services" element={<AdminWrapper><AdminServices /></AdminWrapper>} />
          <Route path="/admin/services/categories" element={<AdminWrapper><AdminServiceCategories /></AdminWrapper>} />

          {/* Operations */}
          <Route path="/admin/addons" element={<AdminWrapper><AdminAddons /></AdminWrapper>} />
          <Route path="/admin/plans" element={<AdminWrapper><AdminPlans /></AdminWrapper>} />
          <Route path="/admin/referrals" element={<AdminWrapper><AdminReferrals /></AdminWrapper>} />
          <Route path="/admin/invite-links" element={<AdminWrapper><AdminInviteLinks /></AdminWrapper>} />
          <Route path="/admin/professions" element={<AdminWrapper><AdminCategories /></AdminWrapper>} />
          <Route path="/admin/explore"     element={<AdminWrapper><AdminExplore /></AdminWrapper>} />

          {/* People */}
          <Route path="/admin/host360" element={<AdminWrapper><Host360List /></AdminWrapper>} />
          <Route path="/admin/host360/:hostId" element={<AdminWrapper><Host360Detail /></AdminWrapper>} />
          <Route path="/admin/guest360" element={<AdminWrapper><Guest360List /></AdminWrapper>} />
          <Route path="/admin/guest360/:key" element={<AdminWrapper><Guest360Detail /></AdminWrapper>} />
          <Route path="/admin/providers" element={<AdminWrapper><AdminProviders /></AdminWrapper>} />
          <Route path="/admin/providers/:status" element={<AdminWrapper><AdminProviders /></AdminWrapper>} />
          <Route path="/admin/kyc" element={<AdminWrapper><AdminKycOverview /></AdminWrapper>} />
          <Route path="/admin/kyc/:status" element={<AdminWrapper><AdminKYC /></AdminWrapper>} />

          {/* Finance */}
          <Route path="/admin/finance/transactions" element={<AdminWrapper><AdminTransactions /></AdminWrapper>} />
          <Route path="/admin/finance/payouts" element={<AdminWrapper><AdminPayouts /></AdminWrapper>} />
          <Route path="/admin/finance/refunds" element={<AdminWrapper><AdminRefunds /></AdminWrapper>} />

          {/* Content */}
          <Route path="/admin/content/pages" element={<AdminWrapper><AdminPages /></AdminWrapper>} />
          <Route path="/admin/content/blogs" element={<AdminWrapper><AdminBlogs /></AdminWrapper>} />
          <Route path="/admin/content/newsletter" element={<AdminWrapper><AdminNewsletter /></AdminWrapper>} />
          <Route path="/admin/content/faq" element={<AdminWrapper><AdminFAQ /></AdminWrapper>} />
          <Route path="/admin/content/testimonials" element={<AdminWrapper><AdminTestimonials /></AdminWrapper>} />

          {/* Support */}
          <Route path="/admin/support/chat" element={<AdminWrapper><AdminSupportChat /></AdminWrapper>} />
          <Route path="/admin/support/insights" element={<AdminWrapper><SupportInsights /></AdminWrapper>} />
          <Route path="/admin/support/tickets" element={<AdminWrapper><AdminTickets /></AdminWrapper>} />
          <Route path="/admin/support/disputes" element={<AdminWrapper><AdminDisputes /></AdminWrapper>} />
          <Route path="/admin/support/reviews" element={<AdminWrapper><AdminReviews /></AdminWrapper>} />
          <Route path="/admin/feedback" element={<AdminWrapper><AdminFeedback /></AdminWrapper>} />
          <Route path="/admin/support/bolt" element={<AdminWrapper><AdminBotSupport /></AdminWrapper>} />
          <Route path="/admin/support/bolt/:page" element={<AdminWrapper><AdminBotSupport /></AdminWrapper>} />

          {/* Platform */}
          <Route path="/admin/platform/appearance" element={<AdminWrapper><AdminAppearance /></AdminWrapper>} />
          <Route path="/admin/platform/menu" element={<AdminWrapper><AdminMenuBuilder /></AdminWrapper>} />
          <Route path="/admin/platform/footer" element={<AdminWrapper><AdminFooterBuilder /></AdminWrapper>} />
          <Route path="/admin/platform/communication" element={<AdminWrapper><AdminCommunication /></AdminWrapper>} />
          <Route path="/admin/notifications" element={<AdminWrapper><AdminNotifications /></AdminWrapper>} />
          <Route path="/admin/campaigns" element={<AdminWrapper><AdminCampaigns /></AdminWrapper>} />
          <Route path="/admin/badges" element={<AdminWrapper><AdminBadges /></AdminWrapper>} />

          {/* Finance — double-entry ledger (P1) */}
          <Route path="/admin/finance" element={<AdminWrapper><AdminFinanceDashboard /></AdminWrapper>} />
          <Route path="/admin/finance/journal" element={<AdminWrapper><AdminJournal /></AdminWrapper>} />
          <Route path="/admin/finance/ledger" element={<AdminWrapper><AdminLedger /></AdminWrapper>} />

          {/* GST command center (P2) */}
          <Route path="/admin/gst" element={<AdminWrapper><AdminGstOverview /></AdminWrapper>} />
          <Route path="/admin/gst/transactions" element={<AdminWrapper><AdminGstTransactions /></AdminWrapper>} />
          <Route path="/admin/gst/invoices" element={<AdminWrapper><AdminGstInvoices /></AdminWrapper>} />
          <Route path="/admin/gst/issues" element={<AdminWrapper><AdminGstIssues /></AdminWrapper>} />
          <Route path="/admin/gst/reconciliation" element={<AdminWrapper><AdminGstReconciliation /></AdminWrapper>} />
          <Route path="/admin/gst/itc" element={<AdminWrapper><AdminGstItc /></AdminWrapper>} />
          <Route path="/admin/gst/returns" element={<AdminWrapper><AdminGstReturns /></AdminWrapper>} />
          <Route path="/admin/gst/reports" element={<AdminWrapper><AdminGstReports /></AdminWrapper>} />
          <Route path="/admin/gst/settings" element={<AdminWrapper><AdminGstSettings /></AdminWrapper>} />
          <Route path="/admin/gst/exports" element={<AdminWrapper><AdminGstExports /></AdminWrapper>} />

          {/* SEO audit dashboard (read-only) */}
          <Route path="/admin/seo" element={<AdminWrapper><AdminSeo /></AdminWrapper>} />
          <Route path="/admin/seo/:view" element={<AdminWrapper><AdminSeo /></AdminWrapper>} />

          {/* System — bare /admin/system has no page; send it to the dashboard */}
          <Route path="/admin/system" element={<Navigate to="/super-dashboard" replace />} />

          {/* System — Staff & Roles, Audit Logs (M1) */}
          <Route path="/admin/staff" element={<AdminWrapper><AdminStaff /></AdminWrapper>} />
          <Route path="/admin/system/audit" element={<AdminWrapper><AdminAudit /></AdminWrapper>} />
          <Route path="/admin/system/reserved" element={<AdminWrapper><AdminReservedSlugs /></AdminWrapper>} />
          <Route path="/admin/security/blocked-ips" element={<AdminWrapper><AdminBlockedIps /></AdminWrapper>} />

          {/* Marketing & performance insights — now a SuperDashboard tab; keep old path as redirect */}
          <Route path="/admin/insights" element={<Navigate to="/super-dashboard/insights" replace />} />

          {/* Departments retired — the two-level nav rail replaces the hub grids.
              Redirect old bookmarks to the dashboard. */}
          <Route path="/admin/dept" element={<Navigate to="/super-dashboard" replace />} />
          <Route path="/admin/dept/:dept" element={<Navigate to="/super-dashboard" replace />} />

          {/* Platform Control */}
          <Route path="/admin/features" element={<AdminWrapper><AdminFeatureStatus /></AdminWrapper>} />

          {/* Sales CRM command center — /admin/sales folds into the Leads workspace */}
          <Route path="/admin/sales" element={<Navigate to="/admin/sales/desk" replace />} />
          <Route path="/admin/sales/desk" element={<AdminWrapper><SalesDesk /></AdminWrapper>} />
          <Route path="/admin/sales/relationships" element={<AdminWrapper><RelationshipDesk /></AdminWrapper>} />
          <Route path="/admin/sales/leads" element={<AdminWrapper><SalesLeads /></AdminWrapper>} />
          <Route path="/admin/sales/leads/:id" element={<AdminWrapper><SalesLeadDetail /></AdminWrapper>} />
          <Route path="/admin/sales/lists" element={<AdminWrapper><SalesLists /></AdminWrapper>} />
          <Route path="/admin/sales/lists/:id" element={<AdminWrapper><SalesLists /></AdminWrapper>} />
          <Route path="/admin/sales/follow-ups" element={<AdminWrapper><SalesFollowUps /></AdminWrapper>} />
          <Route path="/admin/sales/reports" element={<AdminWrapper><SalesReports /></AdminWrapper>} />
          <Route path="/admin/customer/:leadId" element={<AdminWrapper><CustomerDetail /></AdminWrapper>} />
          <Route path="/admin/sales/pipeline" element={<AdminWrapper><SalesPipeline /></AdminWrapper>} />
          <Route path="/admin/sales/templates" element={<AdminWrapper><SalesTemplates /></AdminWrapper>} />
          <Route path="/admin/sales/cold-calling" element={<AdminWrapper><ColdCallingLayout /></AdminWrapper>}>
            <Route index element={<ColdCallOverview />} />
            <Route path="today" element={<ColdCallToday />} />
            <Route path="lead/:leadId" element={<ColdCallLead />} />
            <Route path="follow-ups" element={<ColdCallFollowUps />} />
            <Route path="history" element={<ColdCallHistory />} />
            <Route path="lists" element={<ColdCallLists />} />
            <Route path="reports" element={<ColdCallReports />} />
          </Route>
          {/* Sequences, split by audience (v3.160): host lifecycle → Growth, cold acquisition → Marketing. */}
          <Route path="/admin/growth/sequences" element={<AdminWrapper><SalesSequences audience="customer" title="Lifecycle Sequences" subtitle="Post-signup host journeys — onboarding, activation, win-back. Fire through the gated send queue; nothing sends while the CRM kill-switch is off." /></AdminWrapper>} />
          <Route path="/admin/marketing/sequences" element={<AdminWrapper><SalesSequences audience="lead" title="Acquisition Sequences" subtitle="Automated cold-lead nurture. Fire through the gated send queue; nothing sends while the CRM kill-switch is off." /></AdminWrapper>} />
          {/* Back-compat: the old combined route now lands on lifecycle. */}
          <Route path="/admin/sales/sequences" element={<AdminWrapper><SalesSequences audience="customer" title="Lifecycle Sequences" /></AdminWrapper>} />

          {/* General settings */}
          <Route path="/admin/settings" element={<AdminWrapper><AdminSettings /></AdminWrapper>} />
          <Route path="/admin/settings/payment" element={<AdminWrapper><AdminPaymentSettings /></AdminWrapper>} />

          {/* Explore page */}
          <Route path="/explore" element={<Explore />} />

          {/* Services directory — public SEO (profession-scoped listing pages) */}
          <Route path="/services" element={<ServicesDirectory />} />
          <Route path="/services/:profession" element={<ProfessionServices />} />

          {/* Profession marketing landing pages (/for/:profession) — sell BAS per profession. */}
          {/* Bespoke standalone /for pages must precede the :profession catch-all. */}
          <Route path="/for/astrologers" element={<Astrologers />} />
          <Route path="/for/architects" element={<ArchitectPage />} />
          <Route path="/for/dentists" element={<DentistPage />} />
          <Route path="/for/chartered-accountants" element={<CharteredAccountants />} />
          <Route path="/for/sports-turf" element={<SportsTurf />} />
          <Route path="/for/lawyers" element={<LawyersPage />} />
          <Route path="/for/pediatricians" element={<Pediatricians />} />
          <Route path="/for/gynecologists" element={<Gynecologists />} />
          <Route path="/for/dermatologists" element={<Dermatologists />} />
          <Route path="/for/doctors" element={<GeneralPhysicians />} />
          <Route path="/for/physiotherapists" element={<Physiotherapists />} />
          <Route path="/for/business-consultant" element={<BusinessConsultants />} />
          <Route path="/for/ent-specialists" element={<EntSpecialists />} />
          <Route path="/for/ophthalmologists" element={<Ophthalmologists />} />
          <Route path="/for/nutritionists" element={<Nutritionists />} />
          <Route path="/for/life-coaches" element={<LifeCoaches />} />
          <Route path="/for/spa" element={<Spas />} />
          <Route path="/for/salon" element={<SalonPage />} />
          <Route path="/for/veterinarians" element={<Veterinarians />} />
          <Route path="/for/:profession" element={<ProfessionLanding />} />

          {/* Feature marketing pages (/features/:slug) — use the global Navbar + Footer */}
          {/* Bespoke feature pages precede the /features/:slug template */}
          <Route path="/features/payments" element={<PaymentsFeature />} />
          <Route path="/features/online-scheduling" element={<SchedulingFeature />} />
          <Route path="/features/booking-pages" element={<BookingPagesFeature />} />
          <Route path="/features/availability" element={<AvailabilityFeature />} />
          <Route path="/features/google-calendar" element={<GoogleCalendarFeature />} />
          <Route path="/features/notifications" element={<NotificationsFeature />} />
          <Route path="/features/client-management" element={<ClientManagementFeature />} />
          <Route path="/features/digital-products" element={<DigitalProductsFeature />} />
          <Route path="/features/reviews" element={<ReviewsFeature />} />
          <Route path="/features/analytics" element={<AnalyticsFeature />} />
          <Route path="/features/:slug" element={<FeaturePage />} />

          {/* Support / Contact — placeholders; MUST precede the /:profileSlug catch-all */}
          <Route path="/support" element={<Support />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/get-in-touch" element={<Contact />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          {/* Full-screen shareable product pitch deck (pages/presentation/). */}
          <Route path="/presentation" element={<Presentation />} />
          {/* Investor pitch deck (pages/pitch-deck/) — noindex, unlinked, share-by-link. */}
          <Route path="/pitch-deck" element={<PitchDeck />} />

          {/* Branded error pages — config-driven (see config/errorCatalog.js).
              One <ErrorPage> component renders all of them; adding a code = a
              catalog entry + a <Route> here + the segment in reservedSegments.js.
              Static paths out-rank the /:profileSlug catch-all in RR v6, but they
              MUST precede it (and be reserved) so a user can't claim "/404". */}
          <Route path="/400" element={<ErrorPage code={400} />} />
          <Route path="/401" element={<ErrorPage code={401} />} />
          <Route path="/403" element={<ErrorPage code={403} />} />
          <Route path="/404" element={<ErrorPage code={404} />} />
          <Route path="/405" element={<ErrorPage code={405} />} />
          <Route path="/408" element={<ErrorPage code={408} />} />
          <Route path="/409" element={<ErrorPage code={409} />} />
          <Route path="/410" element={<ErrorPage code={410} />} />
          <Route path="/413" element={<ErrorPage code={413} />} />
          <Route path="/415" element={<ErrorPage code={415} />} />
          <Route path="/422" element={<ErrorPage code={422} />} />
          <Route path="/429" element={<ErrorPage code={429} />} />
          <Route path="/500" element={<ErrorPage code={500} />} />
          <Route path="/502" element={<ErrorPage code={502} />} />
          <Route path="/503" element={<ErrorPage code={503} />} />
          <Route path="/504" element={<ErrorPage code={504} />} />
          {/* /maintenance is a friendly alias for the 503 maintenance page. */}
          <Route path="/maintenance" element={<ErrorPage code={503} />} />
          {/* /offline — reachable now; the Service Worker will serve it from
              cache in a follow-up branch. */}
          <Route path="/offline" element={<Offline />} />

          {/* Hidden archive of the pre-compaction homepage (noindex, unlinked,
              reserved). Holds the sections cut from the live homepage so they
              can be harvested later. Must precede the /:profileSlug catch-all. */}
          <Route path="/_attic" element={<HomeArchive />} />

          {/* Public host/service pages — specific before dynamic */}
          <Route path="/:profileSlug/badges" element={<BadgeShowcase />} />
          <Route path="/:profileSlug/product/:productId" element={<ProductPurchase />} />
          <Route path="/:profileSlug/booking" element={<BookingRedirect />} />
          <Route path="/:profileSlug/booking/:serviceSlug" element={<ServiceBooking />} />
          <Route path="/:profileSlug/:serviceSlug" element={<ServiceDetail />} />
          <Route path="/:profileSlug" element={<HostProfile />} />

          {/* Guest (customer) space — /user/* . A host hitting these is bounced to
              /dashboard by GuestRoute; a guest hitting /dashboard/* is bounced here.
              GuestLayout wraps them in the single-level guest console shell. */}
          <Route element={<GuestRoute><GuestLayout /></GuestRoute>}>
            <Route path="/user" element={<GuestOverview />} />
            <Route path="/user/my-bookings" element={<CustomerBookings />} />
            <Route path="/user/invoices" element={<GuestInvoices />} />
            <Route path="/user/profile" element={<CustomerProfile />} />
            <Route path="/user/reviews" element={<CustomerReviews />} />
            <Route path="/user/loyalty" element={<Loyalty />} />
            <Route path="/user/chat" element={<ChatPage />} />
          </Route>

          {/* Leave a review for one completed booking (booking-completed email CTA).
              Shared + ownership-checked: either party to a booking may use it, so it
              stays role-agnostic and top-level — NOT under /user. */}
          <Route path="/review/:bookingId" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />

          {/* Public, token-authorized guest self-service (MF3 #516). No auth guard —
              the signed manage-booking token IS the auth. Reachable by an anonymous
              (no-session) guest from their confirmation link / email. */}
          <Route path="/manage-booking/:token" element={<ManageBooking />} />

          {/* Backward-compat: old flat guest paths → /user/* (in-flight emails, bookmarks). */}
          <Route path="/my-bookings" element={<Navigate to="/user/my-bookings" replace />} />
          <Route path="/profile" element={<Navigate to="/user/profile" replace />} />
          <Route path="/reviews" element={<Navigate to="/user/reviews" replace />} />
          <Route path="/loyalty" element={<Navigate to="/user/loyalty" replace />} />

          {/* Unknown URL → branded 404 (same component as the /404 route). */}
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </Suspense>
      {!GUIDES_IN_PAGE.test(location.pathname) && <PageGuides pathname={location.pathname} />}
      {footerMode === 'minimal'
        ? !chromeHidden && !location.pathname.startsWith('/admin') && <Footer variant="minimal" />
        : !hideFooter && <Footer variant={isBookingPage ? 'minimal' : 'full'} />}
      </RouteErrorBoundary>
      {!hideBot && (
        <Suspense fallback={null}>
          {HELP_PAGE.test(location.pathname) ? <BotWidget /> : <CookieButton />}
        </Suspense>
      )}
      {/* Site-wide "The Opening" takeover — self-gates on window + route + one-per-device. */}
      <Suspense fallback={null}><OpeningTakeover /></Suspense>
    </ChromeContext.Provider>
  );
}

export default App;
