import { describe, it, expect } from 'vitest';
import { toLeadPayload } from '../pages/enterprise-v2/components/EnterpriseForm';

// The design form uses its own field names; the backend (enterpriseLeadController)
// expects a different contract. toLeadPayload is that rename map — the one piece
// of real logic in the ported form, so it gets the check.
describe('toLeadPayload (enterprise form → backend contract)', () => {
  const form = {
    name: 'Asha Rao',
    organizationName: 'Acme Clinics',
    website: 'https://acme.example',
    industry: 'Healthcare',
    teamSize: '51–200',
    locations: '4–10',
    monthlyBookings: '2,000–10,000',
    phone: '+91 98765 43210',
    businessEmail: 'asha@acme.example',
    company_hp: '',
  };

  it('maps organizationName/businessEmail to the backend orgName/email keys', () => {
    const out = toLeadPayload(form);
    expect(out.orgName).toBe('Acme Clinics');
    expect(out.email).toBe('asha@acme.example');
    expect(out.phone).toBe('+91 98765 43210');
    // These keys already match the backend contract and pass through unchanged.
    expect(out.website).toBe('https://acme.example');
    expect(out.industry).toBe('Healthcare');
    expect(out.teamSize).toBe('51–200');
    expect(out.locations).toBe('4–10');
    expect(out.monthlyBookings).toBe('2,000–10,000');
  });

  it('folds the contact name into requirements (backend has no name column)', () => {
    expect(toLeadPayload(form).requirements).toBe('Contact: Asha Rao');
    expect(toLeadPayload({ ...form, name: '' }).requirements).toBe('');
  });

  it('passes the honeypot through so the server can drop bot submissions', () => {
    expect(toLeadPayload({ ...form, company_hp: 'botfill' }).company_hp).toBe('botfill');
  });
});
