/**
 * tests/unit/crmCap.test.js
 *
 * Free (Sloth) hosts get a CAPPED CRM view — their N most-recent clients (N from
 * limits.crm, passed through as maxClients). Paid plans / admin callers pass -1
 * (unlimited). The cap must keep the MOST-recent N and report a matching total so
 * pagination doesn't page into hidden clients.
 */
let mockBookings = [];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const data = table === 'bookings' ? mockBookings : []; // no persisted crm_customers rows
      const b = { select: () => b, eq: () => b, in: () => b, then: (res) => res({ data, error: null }) };
      return b;
    },
  },
}));

const { listClients } = require('../../services/crmService');

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
const paid = (name, phone, whenDaysAgo) => ({
  id: `${name}-${whenDaysAgo}`, guest_name: name, guest_phone: phone, customer_total: 500,
  status: 'completed', payment_status: 'paid', scheduled_at: daysAgo(whenDaysAgo),
});

describe('crmService.listClients — free-plan cap (maxClients)', () => {
  beforeEach(() => {
    mockBookings = [paid('Old', '9000000001', 90), paid('Mid', '9000000002', 30), paid('New', '9000000003', 5)];
  });

  test('maxClients=2 keeps the 2 MOST-recent clients; total reflects the cap', async () => {
    const { clients, total } = await listClients('host1', { maxClients: 2 });
    expect(total).toBe(2);
    expect(clients.map((c) => c.name)).toEqual(['New', 'Mid']); // recency desc, Old dropped
    expect(clients.map((c) => c.name)).not.toContain('Old');
  });

  test('maxClients=-1 (paid / admin) returns everyone', async () => {
    const { clients, total } = await listClients('host1', { maxClients: -1 });
    expect(total).toBe(3);
    expect(clients.map((c) => c.name).sort()).toEqual(['Mid', 'New', 'Old']);
  });
});
