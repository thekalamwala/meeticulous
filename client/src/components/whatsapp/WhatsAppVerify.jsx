import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappSendOtp, whatsappVerifyOtp } from '../../services/api';
import CountryCodeSelect, { defaultDialCode } from './CountryCodeSelect';

const RESEND_SECONDS = 30;

const WhatsAppVerify = ({ initialPhone = '', initialCountry, onVerified, onPhoneChange }) => {
  const [screen, setScreen] = useState('number'); // 'number' | 'otp'
  const [country, setCountry] = useState(initialCountry || defaultDialCode());
  // Seed the local part only: if the passed number already carries the dial
  // code, strip it so it isn't prepended twice in fullPhone.
  const [number, setNumber] = useState(() => {
    let digits = (initialPhone || '').replace(/[^\d]/g, '');
    const cc = (initialCountry || '').replace(/[^\d]/g, '');
    if (cc && digits.startsWith(cc)) digits = digits.slice(cc.length);
    return digits;
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);   // in-flight guard (auto-submit + button)
  const autoTriedRef = useRef('');       // last code auto-submitted — stops re-fire loop

  const fullPhone = `${country}${number.replace(/[^\d]/g, '')}`;

  useEffect(() => () => clearInterval(timerRef.current), []);
  // Surface the entry to a parent so it can preserve it across an accidental close.
  // onPhoneChange intentionally omitted from deps: parents often pass a fresh
  // callback each render, which would loop. eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onPhoneChange?.({ country, number }); }, [country, number]);

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    setError('');
    if (number.replace(/[^\d]/g, '').length < 7) { setError('Enter a valid WhatsApp number.'); return; }
    setLoading(true);
    sendingRef.current = true;
    try {
      const { data } = await whatsappSendOtp(fullPhone);
      if (!data?.success) throw new Error(data?.message || 'Could not send OTP');
      toast.success('OTP sent to your WhatsApp.');
      setScreen('otp');
      startCooldown();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Could not send OTP');
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verified || verifyingRef.current) return; // latch + in-flight guard
    setError('');
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    verifyingRef.current = true;
    setLoading(true);
    try {
      const { data } = await whatsappVerifyOtp(fullPhone, otp.trim());
      if (!data?.verified) { setError(data?.message || 'Invalid OTP.'); return; }
      setVerified(true);
      onVerified?.(fullPhone);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not verify OTP.');
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  };

  // Principle #2: verify the moment all six digits land (typed or pasted) — no
  // separate Verify click. autoTriedRef stops the same failed code re-firing;
  // editing a digit produces a new code and re-arms it. The code is kept on
  // error (existing behaviour) so the user can correct it.
  useEffect(() => {
    if (screen === 'otp' && otp.trim().length === 6 && !verified && autoTriedRef.current !== otp) {
      autoTriedRef.current = otp;
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, screen, verified]);

  // Return to the number screen to fix a wrong number (OTP screen dead-end fix).
  const handleChangeNumber = () => {
    setScreen('number');
    setOtp('');
    setError('');
    clearInterval(timerRef.current);
    setCooldown(0);
  };

  if (screen === 'number') {
    return (
      <div>
        <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp number</label>
        <div className="flex gap-2">
          <CountryCodeSelect value={country} onChange={setCountry} disabled={loading} />
          <input
            id="wa-number" type="tel" inputMode="numeric"
            className="fb-input flex-1" placeholder="98765 43210"
            value={number} disabled={loading}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ''))}
          />
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        <button
          onClick={handleSend} disabled={loading}
          className="btn bg-primary text-white w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />}
          Send OTP
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">Enter the code sent to <strong>{fullPhone}</strong>.</p>
      <label htmlFor="wa-otp" className="block text-sm font-medium text-gray-700 mb-1.5">Enter OTP</label>
      <input
        id="wa-otp" type="text" inputMode="numeric" maxLength={6}
        className="fb-input fb-input--otp w-full" placeholder="––––––"
        value={otp} disabled={loading}
        onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
      />
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      <button
        onClick={handleVerify} disabled={loading || verified}
        className="btn bg-primary text-white w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />}
        {verified ? 'Verified ✓' : 'Verify OTP'}
      </button>
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          onClick={handleChangeNumber} disabled={loading || verified}
          className="text-gray-500 text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          Change number
        </button>
        <button
          onClick={handleSend} disabled={loading || verified || cooldown > 0}
          className="text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </div>
  );
};

export default WhatsAppVerify;
