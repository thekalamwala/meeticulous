# Project Index — Meeticulous

## Root
| Path | Purpose |
|---|---|
| `CLAUDE.md` | Project memory entry point |
| `docs/` | All AI context and documentation |
| `client/` | React SPA |
| `server/` | Express API |
| `package.json` | Root workspace scripts |

---

## client/src/

### pages/
| File | Route | Purpose |
|---|---|---|
| `Home.jsx` | `/` | Landing page |
| `Login.jsx` | `/login` | Host + guest login |
| `VendorSignup.jsx` | `/vendor/signup` | Host registration |
| `UserSignup.jsx` | `/signup` | Guest registration |
| `ForgotPassword.jsx` | `/forgot-password` | Password reset request |
| `ResetPassword.jsx` | `/reset-password` | Password reset confirm |
| `AdminLogin.jsx` | `/hello-sloth` | Admin login (hidden) |
| `Dashboard.jsx` | `/dashboard` | Host dashboard home |
| `Bookings.jsx` | `/dashboard/bookings` | Host booking management |
| `Earnings.jsx` | `/dashboard/earnings` | Revenue overview |
| `Availability.jsx` | `/dashboard/availability` | Weekly schedule editor |
| `ProfileSetup.jsx` | `/dashboard/profile` | Host profile editor |
| `Products.jsx` | `/dashboard/products` | Digital products list |
| `UpgradePlan.jsx` | `/dashboard/upgrade` | Plan purchase page |
| `Payouts.jsx` | `/dashboard/payments/payouts` | Payout requests |
| `Transactions.jsx` | `/dashboard/payments/transactions` | Transaction history |
| `HostProfile.jsx` | `/:username` | Public host profile |
| `ServiceDetail.jsx` | `/:username/:serviceSlug` | Service detail page |
| `ServiceBooking.jsx` | `/:username/booking/:serviceSlug` | Full booking flow |
| `ProductPurchase.jsx` | `/:username/product/:productId` | Digital product purchase |
| `NotFound.jsx` | `*` | 404 page |

### pages/services/
| File | Route | Purpose |
|---|---|---|
| `ServicesList.jsx` | `/dashboard/services` | Host service list + actions |
| `AddService.jsx` | `/dashboard/service/add-new` | New service form |
| `EditService.jsx` | `/dashboard/service/edit/:id` | Edit service form |
| `ServiceForm.jsx` | — | Shared form component for Add/Edit |

### pages/admin/
| File | Route | Purpose |
|---|---|---|
| `AdminOverview.jsx` | `/admin` | Platform stats |
| `AdminUsers.jsx` | `/admin/users` | User management |
| `AdminBookings.jsx` | `/admin/bookings` | All bookings view |
| `AdminServices.jsx` | `/admin/services` | All services view |
| `AdminSettings.jsx` | `/admin/settings` | Platform settings |

### components/common/
| File | Purpose |
|---|---|
| `Navbar.jsx` | Public-facing top nav |
| `DashboardLayout.jsx` | Sidebar + content shell for `/dashboard/*` |
| `AdminLayout.jsx` | Admin sidebar + content shell |
| `ProtectedRoute.jsx` | Redirects unauthenticated users to `/login` |
| `BackButton.jsx` | Reusable back navigation |
| `ImageCropper.jsx` | Profile/cover image crop modal |

### context/
| File | Purpose |
|---|---|
| `AuthContext.jsx` | Global auth state: user, login, logout, updateUser |

### services/
| File | Purpose |
|---|---|
| `api.js` | All Axios API calls — single source of truth for endpoints |
| `supabaseClient.js` | Supabase anon client (auth listener only) |

### utils/
| File | Purpose |
|---|---|
| `themeUtils.js` | Host theme colors, contrast, plan borders |

### styles/
| File | Purpose |
|---|---|
| `design-tokens.css` | CSS custom properties (colors, spacing, radius, shadows) |
| `base-fb.css` | Base typography + form element resets |
| `components/button.css` | `.fb-btn` variants |
| `components/card.css` | `.fb-card` variants |
| `components/input.css` | `.fb-input` styles |
| `components/badge.css` | `.badge-*` styles |
| `components/modal.css` | Modal overlay styles |

---

## server/

### controllers/
| File | Owns |
|---|---|
| `authController.js` | Register, login, Google OAuth, OTP send/verify, password reset, getMe |
| `bookingController.js` | Create booking, slots, host/guest lists, cancel, complete, reschedule, reminders |
| `hostController.js` | Host profile, services CRUD (legacy), availability, vendor search |
| `serviceController.js` | Service Module v2: CRUD with slug, rich fields, duplicate, toggle |
| `paymentController.js` | Razorpay orders, verify payment, plan subscriptions, products |
| `vendorController.js` | Transactions, payout balance, payout requests |
| `adminController.js` | Admin stats, user management, booking management, settings |
| `adminAuthController.js` | Admin login + OTP verification |
| `reviewController.js` | Create review, get host reviews |
| `productController.js` | Digital products CRUD, purchase, download |
| `uploadController.js` | Supabase Storage image upload (bucket `images`) |

### routes/
| File | Base Path |
|---|---|
| `authRoutes.js` | `/api/auth` |
| `adminAuthRoutes.js` | `/api/admin-auth` |
| `hostRoutes.js` | `/api/host` |
| `bookingRoutes.js` | `/api/bookings` |
| `paymentRoutes.js` | `/api/payment` |
| `adminRoutes.js` | `/api/admin` |
| `reviewRoutes.js` | `/api/reviews` |
| `productRoutes.js` | `/api/products` |
| `uploadRoutes.js` | `/api/upload` |
| `vendorRoutes.js` | `/api/vendor` |
| `serviceRoutes.js` | `/api/services` |

### middleware/
| File | Purpose |
|---|---|
| `authMiddleware.js` | `protect`: verifies Supabase JWT, attaches `req.user` |
| `adminMiddleware.js` | `adminProtect`: verifies admin JWT |
| `planMiddleware.js` | `attachPlan`, `checkServiceLimit`, `checkProductLimit`, `checkBookingReceiveLimit` |
| `security.js` | Helmet, rate limiting, speed limiting, HPP, XSS clean |
| `errorMiddleware.js` | Global Express error handler |
| `validate.js` | express-validator helpers |

### config/
| File | Purpose |
|---|---|
| `supabase.js` | Exports `supabaseAdmin` (service role — bypasses RLS) |
| `google.js` | Google Calendar OAuth2 client + `createCalendarEvent` |
| `schema.sql` | Canonical DB schema (run first on new Supabase project) |
| `migration_v*.sql` | Legacy migration files (superseded by `migrations/`) |

### migrations/
| File | Purpose |
|---|---|
| `v1.1.sql` | otp_codes table |
| `v1.2.sql` | Plans on profiles, plan_purchases table |
| `v1.3.sql` | thumbnail_url, grace_period_minutes, service slug |
| `v1.4.sql` | payout_requests table |
| `v1.5.sql` | increment_product_purchase_count function |
| `v1.6_catchup.sql` | Catches up all prior migrations safely |
| `v1.7_pricing_snapshot.sql` | Adds `commission_applied` to bookings ⚠️ PENDING |

### lib/
| File | Purpose |
|---|---|
| `pricingEngine.js` | Pure functions: `calculatePlatformFee`, `calculateCommission`, `calculateVendorPayout` |

### utils/
| File | Purpose |
|---|---|
| `otpStore.js` | DB-backed OTP store (uses `otp_codes` table via supabaseAdmin) |
| `sendEmail.js` | Nodemailer SMTP wrapper |
| `notify.js` | Email + WhatsApp notification dispatcher (routes through `notificationEngine.js` to AiSensy) |
| `logger.js` | Winston logger |
