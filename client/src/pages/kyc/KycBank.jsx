import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useKyc } from '../../context/KycContext';
import { Card, FormField, Input, Select, Button } from '../../components/dashboard/ui';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function KycBank() {
  const { bank, setBank } = useKyc();
  const navigate = useNavigate();
  const set = (k) => (e) => setBank((b) => ({ ...b, [k]: e.target.value }));

  const next = (e) => {
    e.preventDefault();
    const ifsc = bank.ifsc.trim().toUpperCase();
    const acct = bank.account_number.replace(/\s/g, '');
    if (!bank.holder_name.trim()) return toast.error('Enter the account holder name');
    if (!bank.bank_name.trim()) return toast.error('Enter the bank name');
    if (!/^[0-9]{6,18}$/.test(acct)) return toast.error('Enter a valid account number');
    if (!IFSC.test(ifsc)) return toast.error('IFSC must look like ABCD0123456');
    setBank((b) => ({ ...b, ifsc, account_number: acct }));
    navigate('/dashboard/kyc/flow/address');
  };

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-0.5 text-base font-semibold text-gray-900">Bank account</h2>
      <p className="mb-4 text-sm text-gray-500">Payouts are sent to this account after verification.</p>
      <form onSubmit={next} className="space-y-3">
        <FormField label="Account holder name" htmlFor="b-holder" required className="mb-0">
          <Input id="b-holder" value={bank.holder_name} onChange={set('holder_name')} placeholder="As per bank records" />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Bank name" htmlFor="b-bank" required className="mb-0">
            <Input id="b-bank" value={bank.bank_name} onChange={set('bank_name')} placeholder="e.g. HDFC Bank" />
          </FormField>
          <FormField label="Branch" htmlFor="b-branch" className="mb-0">
            <Input id="b-branch" value={bank.branch} onChange={set('branch')} placeholder="Optional" />
          </FormField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Account number" htmlFor="b-acct" required className="mb-0">
            <Input id="b-acct" inputMode="numeric" value={bank.account_number} onChange={set('account_number')} placeholder="Account number" />
          </FormField>
          <FormField label="IFSC" htmlFor="b-ifsc" required hint="Format: ABCD0123456" className="mb-0">
            <Input id="b-ifsc" value={bank.ifsc} onChange={set('ifsc')} maxLength={11} className="uppercase" placeholder="HDFC0001234" />
          </FormField>
        </div>
        <FormField label="Account type" htmlFor="b-type" required className="mb-0">
          <Select id="b-type" value={bank.account_type} onChange={set('account_type')}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </Select>
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" size="lg" variant="outline" full onClick={() => navigate('/dashboard/kyc/flow/start')}>Back</Button>
          <Button type="submit" size="lg" full>Continue</Button>
        </div>
      </form>
    </Card>
  );
}
