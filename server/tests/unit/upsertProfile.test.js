/**
 * tests/unit/upsertProfile.test.js
 * Unit tests for upsertProfile name-split + avatar capture (Phase 1).
 */
jest.mock('../../config/supabase', () => {
  const mockChain = () => {
    const chain = {
      select:      jest.fn().mockReturnThis(),
      insert:      jest.fn().mockReturnThis(),
      update:      jest.fn().mockReturnThis(),
      upsert:      jest.fn().mockReturnThis(),
      delete:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      neq:         jest.fn().mockReturnThis(),
      single:      jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    return chain;
  };

  const signIn = jest.fn();
  return {
    supabaseAdmin: {
      auth: {
        admin: {
          createUser: jest.fn(),
          deleteUser: jest.fn(),
          listUsers:  jest.fn(),
        },
        signInWithPassword: signIn,
      },
      from: jest.fn().mockImplementation(() => mockChain()),
    },
    signInWithPassword: (email, password) => signIn({ email, password }),
  };
});

jest.mock('../../utils/sendEmail',  () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify',     () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore',   () => ({
  set:      jest.fn().mockResolvedValue({ ok: true }),
  verify:   jest.fn(),
  generate: jest.fn(() => '123456'),
}));

jest.mock('../../services/usernameService', () => ({
  resolve:               jest.fn().mockResolvedValue(null),
  createInitialUsername: jest.fn().mockResolvedValue('auto-handle-x1'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
  usernameExists:        jest.fn().mockResolvedValue(false),
  changeUsername:        jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { upsertProfile } = require('../../controllers/authController');

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE_ARGS = {
  id:    'profile-uuid',
  name:  'Ada Lovelace',
  email: 'ada@example.com',
  role:  'host',
};

const PROFILE_ROW = {
  ...BASE_ARGS,
  username: 'auto-handle-x1',
  plan: 'explorer',
  profile_image: '',
};

/** Capture the object passed to .upsert() on the 'profiles' table. */
const captureUpsertArg = (returnData = PROFILE_ROW) => {
  let captured = null;
  const upsertFn = jest.fn().mockImplementation((obj) => {
    captured = obj;
    return chain;
  });
  const chain = {
    select:      jest.fn().mockReturnThis(),
    upsert:      upsertFn,
    eq:          jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),  // no existing username
    single:      jest.fn().mockResolvedValue({ data: returnData, error: null }),
  };
  supabaseAdmin.from.mockImplementation(() => chain);
  return () => captured;
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('upsertProfile — name-split + avatar fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes first_name, last_name, and profile_image when all supplied', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({
      ...BASE_ARGS,
      first_name: 'Ada',
      last_name:  'Lovelace',
      avatar:     'https://img/x.png',
    });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect(arg.first_name).toBe('Ada');
    expect(arg.last_name).toBe('Lovelace');
    expect(arg.profile_image).toBe('https://img/x.png');
  });

  test('omits profile_image when avatar is falsy (undefined)', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({
      ...BASE_ARGS,
      first_name: 'Ada',
      last_name:  'Lovelace',
      // avatar omitted
    });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('profile_image' in arg).toBe(false);
  });

  test('omits profile_image when avatar is empty string', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({
      ...BASE_ARGS,
      avatar: '',
    });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('profile_image' in arg).toBe(false);
  });

  test('omits profile_image when avatar is null', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({
      ...BASE_ARGS,
      avatar: null,
    });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('profile_image' in arg).toBe(false);
  });

  test('omits first_name from upsert when not supplied', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({ ...BASE_ARGS });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('first_name' in arg).toBe(false);
  });

  test('omits last_name from upsert when not supplied', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({ ...BASE_ARGS });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('last_name' in arg).toBe(false);
  });

  test('omits first_name when undefined is explicitly passed', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({ ...BASE_ARGS, first_name: undefined });

    const arg = getArg();
    expect(arg).toBeDefined();
    expect('first_name' in arg).toBe(false);
  });

  test('still writes core fields regardless of name-split args', async () => {
    const getArg = captureUpsertArg();

    await upsertProfile({
      ...BASE_ARGS,
      first_name: 'Ada',
      last_name:  'Lovelace',
      avatar:     'https://img/x.png',
    });

    const arg = getArg();
    expect(arg.id).toBe('profile-uuid');
    expect(arg.email).toBe('ada@example.com');
    expect(arg.role).toBe('host');
    expect(arg.name).toBe('Ada Lovelace');
  });
});
