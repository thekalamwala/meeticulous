// Every live host page, and where the proposed IA puts it. Nothing is dropped.
//
// This table IS the existing-feature preservation checklist. It lives in its own
// module so both the shell and Settings › Where things moved read the same list —
// a feature cannot quietly vanish from the redesign without vanishing from here.
export const LIVE_PAGE_MAP = [
  ['/dashboard', 'Today'],
  ['/dashboard/bookings', 'Bookings'],
  ['/dashboard/availability', 'Schedule › Hours'],
  ['/dashboard/clients', 'Clients'],
  ['/dashboard/clients/:id', 'Clients › client drawer'],
  ['/dashboard/services', 'Catalog › Services'],
  ['/dashboard/service/add-new', 'Catalog › Services › New service'],
  ['/dashboard/service/edit/:id', 'Catalog › Services › Edit'],
  ['/dashboard/service/view/:id', 'Catalog › Services › Edit'],
  ['/dashboard/products', 'Catalog › Products'],
  ['/dashboard/courses', 'Catalog › Courses'],
  ['/dashboard/membership', 'Catalog › Memberships'],
  ['/dashboard/coupons', 'Catalog › Offers'],
  ['/dashboard/earnings', 'Money › Earnings'],
  ['/dashboard/payments/payouts', 'Money › Payouts'],
  ['/dashboard/payments/transactions', 'Money › Transactions'],
  ['/dashboard/invoices', 'Money › Invoices'],
  ['/dashboard/testimonials', 'Grow › Social proof'],
  ['/dashboard/referrals', 'Grow › Refer & earn'],
  ['/dashboard/profile', 'Settings › Account  +  Grow › Booking page'],
  ['/dashboard/upgrade', 'Settings › Plan & billing'],
  ['/dashboard/kyc', 'Settings › Verification  (+ a Today action card)'],
  ['/dashboard/kyc/flow', 'Settings › Verification › flow'],
  ['/dashboard/chat', 'Settings › Help  (+ a topbar help button)'],
  ['/dashboard/feedback', 'Settings › Help › Send feedback'],
];

export default LIVE_PAGE_MAP;
