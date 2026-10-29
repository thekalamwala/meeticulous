/**
 * tests/integration/helpers.js
 * Shared helpers and mock factories for Supertest integration tests.
 */
const express = require('express');

// ── Minimal Express app factory ───────────────────────────────────────────────
// Attach only the routes under test so each suite is isolated.
const buildApp = (...routeAttachers) => {
  const app = express();
  app.use(express.json());
  routeAttachers.forEach((fn) => fn(app));
  return app;
};

// ── Common supabase mock factory ──────────────────────────────────────────────
// Call inside jest.mock('../../config/supabase') to get a configurable stub.
const makeSbMock = () => {
  const fluent = (resolved = { data: null, error: null }) => ({
    select:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    upsert:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    neq:         jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    range:       jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    or:          jest.fn().mockReturnThis(),
    ilike:       jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });

  const signIn = jest.fn();
  return {
    supabaseAdmin: {
      from: jest.fn().mockImplementation(() => fluent()),
      auth: {
        admin: {
          createUser:  jest.fn(),
          deleteUser:  jest.fn(),
          listUsers:   jest.fn(),
        },
        signInWithPassword: signIn,
      },
    },
    // Disposable-client sign-in helper used by the controllers; delegates to the
    // same jest.fn so tests can drive it via supabaseAdmin.auth.signInWithPassword.
    signInWithPassword: (email, password) => signIn({ email, password }),
  };
};

// ── Auth header builders ──────────────────────────────────────────────────────
const vendorAuth  = (token = 'vendor-token')  => ({ Authorization: `Bearer ${token}` });
const userAuth    = (token = 'user-token')    => ({ Authorization: `Bearer ${token}` });
const adminAuth   = (token = 'admin-token')   => ({ Authorization: `Bearer ${token}` });

// ── Sample data fixtures ──────────────────────────────────────────────────────
const VENDOR_PROFILE = {
  id: 'vendor-uuid', name: 'Jane Vendor', email: 'jane@vendor.com',
  role: 'host', plan: 'explorer', username: 'jane-vendor',
  bio: 'Coach', profession: 'Life Coach', location: 'Mumbai',
  profile_image: '', cover_image: '', social_links: {}, theme_color: '#FE5100',
  google_calendar_connected: false, is_verified: true, badges: [],
};

const USER_PROFILE = {
  id: 'user-uuid', name: 'Bob User', email: 'bob@user.com',
  role: 'guest', plan: 'explorer', username: 'bob-user',
  bio: '', profession: '', location: '',
  profile_image: '', cover_image: '', social_links: {}, theme_color: null,
  google_calendar_connected: false, is_verified: false, badges: [],
};

const ADMIN_PROFILE = {
  id: 'admin-uuid', name: 'Admin', email: 'book@bookasloth.com',
  role: 'superadmin',
};

const SERVICE = {
  id: 'svc-1', host_id: 'vendor-uuid', title: 'Consultation',
  slug: 'consultation', price: 500, duration: 45, meeting_mode: 'online',
  is_active: true,
};

const BOOKING = {
  id: 'booking-1', host_id: 'vendor-uuid', guest_id: 'user-uuid',
  service_id: 'svc-1', scheduled_at: new Date(Date.now() + 86400000).toISOString(),
  status: 'confirmed', payment_status: 'pending',
};

module.exports = {
  buildApp, makeSbMock,
  vendorAuth, userAuth, adminAuth,
  VENDOR_PROFILE, USER_PROFILE, ADMIN_PROFILE, SERVICE, BOOKING,
};
