import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useKyc } from '../../context/KycContext';
import { useAuth } from '../../context/AuthContext';
import { FormField, Input, Button } from '../../components/dashboard/ui';

const RE = { pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/, aadhaar: /^[0-9]{12}$/, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, phone: /^[0-9]{10,15}$/ };

export default function KycStart() {
  const { personal, setPersonal } = useKyc();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Prefill from the logged-in host once, without clobbering edits.
  useEffect(() => {
    setPersonal((p) => ({
      ...p,
      full_name: p.full_name || user?.name || user?.full_name || '',
      email: p.email || user?.email || '',
      phone: p.phone || (user?.phone ? String(user.phone).replace(/\D/g, '') : ''),
    }));
  }, [user, setPersonal]);

  const set = (k) => (e) => setPersonal((p) => ({ ...p, [k]: e.target.value }));

  const next = (e) => {
    e.preventDefault();
    const pan = personal.pan_number.trim().toUpperCase();
    if (!personal.full_name.trim()) return toast.error('Enter your full name');
    if (!RE.email.test(personal.email.trim())) return toast.error('Enter a valid email');
    if (!RE.phone.test(personal.phone.replace(/\D/g, ''))) return toast.error('Enter a valid phone number');
    if (!RE.pan.test(pan)) return toast.error('PAN must look like ABCDE1234F');
    setPersonal((p) => ({ ...p, pan_number: pan }));
    navigate('/dashboard/kyc/flow/bank');
  };

  return (
    <section className="rounded-[24px] bg-white p-5 sm:p-6">
      <h2 className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink sm:text-[20px]">Personal details</h2>
      <p className="mb-5 mt-1 text-[14px] text-muted">These must match your PAN exactly.</p>
      <form onSubmit={next} className="space-y-4">
        <FormField label="Full name" htmlFor="k-name" required className="mb-0">
          <Input id="k-name" value={personal.full_name} onChange={set('full_name')} placeholder="As printed on PAN" />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Email" htmlFor="k-email" required className="mb-0">
            <Input id="k-email" type="email" value={personal.email} onChange={set('email')} placeholder="you@email.com" />
          </FormField>
          <FormField label="Phone" htmlFor="k-phone" required className="mb-0">
            <Input id="k-phone" inputMode="numeric" value={personal.phone} onChange={set('phone')} placeholder="10-digit number" />
          </FormField>
        </div>
        <FormField label="PAN number" htmlFor="k-pan" required hint="Format: ABCDE1234F" className="mb-0">
          <Input id="k-pan" value={personal.pan_number} onChange={set('pan_number')} maxLength={10} className="uppercase" placeholder="ABCDE1234F" />
        </FormField>
        <div className="pt-2">
          <Button type="submit" size="lg" full>Continue</Button>
        </div>
      </form>
    </section>
  );
}
