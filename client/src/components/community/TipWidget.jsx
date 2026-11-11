import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Heart } from 'lucide-react';
import { buildUpiUri } from '../../utils/upi';

// Peer-to-peer UPI tip jar. Payer scans the QR (desktop) or taps "Open UPI app"
// (mobile) and pays the contributor's VPA directly — nothing is recorded here.
// ponytail: no backend, no ledger, no payout. Swap `vpa` to pay someone else.

const PRESETS = [100, 200, 500];
// Brand mark at the QR centre. level="H" keeps ~30% error correction so the
// excavated logo patch never breaks the scan.
const LOGO = '/brand/ds/06-favicon/favicon.svg';

export default function TipWidget({ vpa, payeeName, note = 'Community tip', heading = 'Say thanks' }) {
  const [amount, setAmount] = useState(200);
  const [custom, setCustom] = useState('');

  // Custom input wins when it holds a positive number; else the selected preset.
  const customNum = Number(custom);
  const effective = custom !== '' && Number.isFinite(customNum) && customNum > 0 ? customNum : amount;
  const uri = buildUpiUri({ pa: vpa, pn: payeeName, am: effective, tn: note });

  return (
    <section aria-labelledby="tip-heading" className="mt-card gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush text-maroon">
          <Heart size={18} aria-hidden="true" />
        </span>
        <h3 id="tip-heading" className="font-display text-xl text-maroon">{heading}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink/70">
        {payeeName} keeps the community warm for free. Leave a tip straight to their UPI — it goes to them, not us.
      </p>

      <div role="group" aria-label="Tip amount" className="flex flex-wrap gap-2">
        {PRESETS.map((v) => {
          const on = custom === '' && amount === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => { setAmount(v); setCustom(''); }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                on ? 'bg-maroon text-cream' : 'bg-cream text-ink hover:bg-blush'}`}
            >
              ₹{v}
            </button>
          );
        })}
        <label className="relative flex items-center">
          <span className="sr-only">Custom amount in rupees</span>
          <span className="pointer-events-none absolute left-3 text-sm text-ink/50">₹</span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Other"
            className="w-24 rounded-full border-2 border-ink/10 py-2 pl-7 pr-3 text-sm focus:border-maroon focus:outline-none"
          />
        </label>
      </div>

      <figure className="flex flex-col items-center gap-3 rounded-2xl bg-cream p-5">
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={uri}
            size={180}
            level="H"
            fgColor="#960D32"
            bgColor="#FFFFFF"
            imageSettings={{ src: LOGO, height: 38, width: 38, excavate: true }}
          />
        </div>
        <figcaption className="text-center text-sm text-ink/70">
          Scan to tip <strong className="text-ink">₹{effective}</strong>
          <br />
          <span className="text-xs text-ink/50">{vpa}</span>
        </figcaption>
      </figure>

      <a href={uri} className="mt-btn mt-btn--block no-underline">
        Open UPI app · ₹{effective}
      </a>
      <p className="text-center text-xs text-ink/50">
        Opens PhonePe / GPay / Paytm on your phone. You can change the amount there.
      </p>
    </section>
  );
}
