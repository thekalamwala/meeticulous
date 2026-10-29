import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { submitKyc as apiSubmitKyc } from '../services/api';

/**
 * KycContext — single source of truth for the KYC flow (2 steps: personal + bank).
 * Razorpay Route verifies the PAN number + bank + address; no Aadhaar and no
 * document/selfie uploads are collected.
 */
const KycContext = createContext(null);

const EMPTY_PERSONAL = { full_name: '', email: '', phone: '', pan_number: '' };
const EMPTY_BANK = { holder_name: '', bank_name: '', account_number: '', ifsc: '', branch: '', account_type: 'savings' };
// Registered address — required for the Razorpay Route linked account.
const EMPTY_ADDRESS = { addr_street1: '', addr_street2: '', addr_city: '', addr_state: '', addr_postal_code: '', addr_country: 'IN' };

export function KycProvider({ children }) {
  const [personal, setPersonal] = useState(EMPTY_PERSONAL);
  const [bank, setBank] = useState(EMPTY_BANK);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  // Step completion — drives the guards. A step is done when its data is present.
  const done = useMemo(() => {
    const p = personal.full_name && personal.email && personal.phone && personal.pan_number;
    const b = bank.holder_name && bank.bank_name && bank.account_number && bank.ifsc && bank.account_type;
    const a = address.addr_street1 && address.addr_city && address.addr_state && address.addr_postal_code;
    return { personal: !!p, bank: !!b, address: !!a };
  }, [personal, bank, address]);

  const submit = useCallback(async () => {
    const { data } = await apiSubmitKyc({ ...personal, ...bank, ...address });
    return data;
  }, [personal, bank, address]);

  const value = useMemo(
    () => ({ personal, setPersonal, bank, setBank, address, setAddress, done, submit }),
    [personal, bank, address, done, submit]
  );

  return <KycContext.Provider value={value}>{children}</KycContext.Provider>;
}

export function useKyc() {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error('useKyc must be used within KycProvider');
  return ctx;
}
