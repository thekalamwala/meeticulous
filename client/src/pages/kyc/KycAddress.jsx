import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useKyc } from '../../context/KycContext';
import { Card, FormField, Input, Button } from '../../components/dashboard/ui';

export default function KycAddress() {
  const { address, setAddress, submit } = useKyc();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const setAddr = (k) => (e) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  // Address is the final input step — submit the whole KYC here.
  const onSubmit = async (e) => {
    e.preventDefault();
    const pin = (address.addr_postal_code || '').replace(/\s/g, '');
    if (!address.addr_street1.trim()) return toast.error('Enter your address line 1');
    // Razorpay Route requires street2 on the linked account — collect it, don't skip.
    if (!address.addr_street2.trim()) return toast.error('Enter your address line 2');
    if (!address.addr_city.trim()) return toast.error('Enter your city');
    if (!address.addr_state.trim()) return toast.error('Enter your state');
    if (!/^[0-9]{6}$/.test(pin)) return toast.error('PIN code must be 6 digits');
    setAddress((a) => ({ ...a, addr_postal_code: pin }));
    setSubmitting(true);
    try {
      await submit();
      navigate('/dashboard/kyc/flow/submitted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-0.5 text-base font-semibold text-gray-900">Registered address</h2>
      <p className="mb-4 text-sm text-gray-500">Required to set up your payout account.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Address line 1" htmlFor="a-street1" required className="mb-0">
          <Input id="a-street1" value={address.addr_street1} onChange={setAddr('addr_street1')} placeholder="House / street" />
        </FormField>
        <FormField label="Address line 2" htmlFor="a-street2" required className="mb-0">
          <Input id="a-street2" value={address.addr_street2} onChange={setAddr('addr_street2')} placeholder="Area / landmark" />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="City" htmlFor="a-city" required className="mb-0">
            <Input id="a-city" value={address.addr_city} onChange={setAddr('addr_city')} placeholder="City" />
          </FormField>
          <FormField label="State" htmlFor="a-state" required className="mb-0">
            <Input id="a-state" value={address.addr_state} onChange={setAddr('addr_state')} placeholder="State" />
          </FormField>
        </div>
        <FormField label="PIN code" htmlFor="a-pin" required hint="6 digits" className="mb-0">
          <Input id="a-pin" inputMode="numeric" maxLength={6} value={address.addr_postal_code} onChange={setAddr('addr_postal_code')} placeholder="560001" />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" size="lg" variant="outline" full onClick={() => navigate('/dashboard/kyc/flow/bank')}>Back</Button>
          <Button type="submit" size="lg" full disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for verification'}</Button>
        </div>
      </form>
    </Card>
  );
}
