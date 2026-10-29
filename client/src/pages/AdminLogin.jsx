import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLoginUser, adminChangePassword, admin2faSetup, admin2faConfirm, admin2faVerify } from "../services/api";
import toast from "react-hot-toast";

// SECURITY: Isolated admin login with TOTP 2FA.
// Phase 1 — password:  POST /admin-auth/login
//   → { token }               back-compat: store + navigate immediately
//   → { twofa_required, pending_token }  → Phase 2a (verify existing TOTP)
//   → { enroll_required, pending_token } → Phase 2b (setup + confirm new TOTP)
// Phase 2a (code)   — POST /admin-auth/2fa-verify
// Phase 2b (enroll) — POST /admin-auth/2fa-setup  then  /admin-auth/2fa-confirm
// Phase 3 (recovery) — show recovery codes once, then store session + navigate.
// Session stored under 'bas_admin' — NEVER overwrites the 'user' session.

// ─── shared UI atoms ────────────────────────────────────────────────────────

const LockIcon = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const OrangeBtn = ({ loading, label, loadingLabel, ...rest }) => (
  <button
    type="submit"
    disabled={loading}
    className="btn w-full py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 mt-2"
    style={{ background: "#0079C1" }}
    {...rest}
  >
    {loading ? loadingLabel : label}
  </button>
);

// ─── Phase 1: Password ───────────────────────────────────────────────────────

const PasswordStep = ({ onResult }) => {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim() || !form.password) {
      toast.error("Enter username and password");
      return;
    }
    setLoading(true);
    try {
      const { data } = await adminLoginUser({
        identifier: form.identifier.trim(),
        password: form.password,
      });
      onResult(data, form.password);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-identifier" className="block text-xs font-medium text-gray-400 mb-1.5">
          Username
        </label>
        <input
          id="admin-identifier"
          type="text"
          required
          autoComplete="username"
          autoFocus
          placeholder="username"
          className="fb-input bg-gray-800 text-white border-gray-700 placeholder-gray-600"
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="block text-xs font-medium text-gray-400 mb-1.5">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          autoComplete="current-password"
          className="fb-input bg-gray-800 text-white border-gray-700"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <OrangeBtn loading={loading} label="Grant Access" loadingLabel="Verifying…" />
    </form>
  );
};

// ─── Phase 2a: Code (existing TOTP) ─────────────────────────────────────────

const CodeStep = ({ pendingToken, onSuccess }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Enter the authenticator code");
      return;
    }
    setLoading(true);
    try {
      const { data } = await admin2faVerify({ pending_token: pendingToken, code: code.trim() });
      onSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-totp-code" className="block text-xs font-medium text-gray-400 mb-1.5">
          Authenticator code
        </label>
        <input
          id="admin-totp-code"
          type="text"
          inputMode="numeric"
          required
          autoFocus
          placeholder="123456"
          maxLength={8}
          className="fb-input bg-gray-800 text-white border-gray-700 placeholder-gray-600 tracking-widest text-center text-lg"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <p className="text-xs text-gray-500 mt-1.5">
          Enter the 6-digit code from your authenticator app, or a recovery code.
        </p>
      </div>
      <OrangeBtn loading={loading} label="Verify" loadingLabel="Verifying…" />
    </form>
  );
};

// ─── Phase 2b: Enroll (setup QR + confirm) ──────────────────────────────────

const EnrollStep = ({ qrDataUrl, secret, pendingToken, onSuccess }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Enter the authenticator code");
      return;
    }
    setLoading(true);
    try {
      const { data } = await admin2faConfirm({ pending_token: pendingToken, code: code.trim() });
      onSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">
        Scan this QR code in <span className="font-semibold text-white">Google Authenticator</span> or{" "}
        <span className="font-semibold text-white">Authy</span>, then enter the 6-digit code below.
      </p>

      {/* QR code */}
      <div className="flex justify-center py-2">
        <img
          src={qrDataUrl}
          alt="TOTP QR code — scan with authenticator app"
          className="rounded-lg border border-gray-700"
          style={{ width: 180, height: 180, objectFit: "contain" }}
        />
      </div>

      {/* Manual entry secret */}
      {secret && (
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-500 mb-1">Or enter this key manually:</p>
          <code className="text-xs text-orange-400 break-all select-all">{secret}</code>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-enroll-code" className="block text-xs font-medium text-gray-400 mb-1.5">
            Authenticator code
          </label>
          <input
            id="admin-enroll-code"
            type="text"
            inputMode="numeric"
            required
            autoFocus
            placeholder="123456"
            maxLength={8}
            className="fb-input bg-gray-800 text-white border-gray-700 placeholder-gray-600 tracking-widest text-center text-lg"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <OrangeBtn loading={loading} label="Activate 2FA" loadingLabel="Confirming…" />
      </form>
    </div>
  );
};

// ─── Forced password change (first login with a temp password) ──────────────

const ChangePasswordStep = ({ changeToken, currentPassword, onDone }) => {
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw.next.length < 10) { toast.error("New password must be at least 10 characters"); return; }
    if (pw.next !== pw.confirm) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      await adminChangePassword({
        password_change_token: changeToken,
        current_password: currentPassword,
        new_password: pw.next,
      });
      toast.success("Password set — please log in again");
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not set password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-300">
        Set a new password to finish securing your account. You'll then log in again and set up two-factor authentication.
      </p>
      <div>
        <label htmlFor="admin-new-pw" className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>
        <input
          id="admin-new-pw"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          className="fb-input bg-gray-800 text-white border-gray-700"
          value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
        />
        <p className="text-xs text-gray-500 mt-1.5">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="admin-confirm-pw" className="block text-xs font-medium text-gray-400 mb-1.5">Confirm new password</label>
        <input
          id="admin-confirm-pw"
          type="password"
          required
          autoComplete="new-password"
          className="fb-input bg-gray-800 text-white border-gray-700"
          value={pw.confirm}
          onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
        />
      </div>
      <OrangeBtn loading={loading} label="Set password" loadingLabel="Saving…" />
    </form>
  );
};

// ─── Phase 3: Recovery codes (shown once) ────────────────────────────────────

const RecoveryStep = ({ codes, onContinue }) => (
  <div className="space-y-4">
    <div className="text-center">
      <p className="text-sm font-semibold text-white">Two-factor authentication enabled!</p>
      <p className="text-xs text-gray-400 mt-1">
        Save these recovery codes somewhere safe — they are shown <span className="text-orange-400 font-semibold">once only</span>.
      </p>
    </div>
    <div className="bg-gray-800 rounded-lg p-3 space-y-1">
      {(codes || []).map((c) => (
        <code key={c} className="block text-sm text-green-400 font-mono tracking-wider">
          {c}
        </code>
      ))}
    </div>
    <button
      type="button"
      onClick={onContinue}
      className="btn w-full py-2.5 text-sm font-bold text-white transition-opacity mt-2"
      style={{ background: "#0079C1" }}
    >
      Continue
    </button>
  </div>
);

// ─── Root component ───────────────────────────────────────────────────────────

const AdminLogin = () => {
  // step: 'password' | 'code' | 'enroll' | 'recovery'
  const [step,         setStep]         = useState("password");
  const [pendingToken, setPendingToken] = useState(null);
  const [qrDataUrl,    setQrDataUrl]    = useState(null);
  const [secret,       setSecret]       = useState(null);
  const [session,      setSession]      = useState(null);   // full session from confirm
  const [pwChangeToken, setPwChangeToken] = useState(null); // forced first-login password change
  const [tempPassword,  setTempPassword]  = useState("");   // the temp pw, re-verified by the change endpoint
  const navigate = useNavigate();

  // Called when the server responds to POST /admin-auth/login
  const handlePasswordResult = async (data, password) => {
    // Forced first-login password change — temp password must be replaced before
    // any session or 2FA enrollment is issued (closes the enrollment race).
    if (data.must_set_password) {
      setPwChangeToken(data.password_change_token);
      setTempPassword(password || "");
      setStep("change-password");
      return;
    }

    if (data.token) {
      // Back-compat: server returned a full session directly (2FA not yet configured
      // for this admin or feature flag off). Store immediately.
      localStorage.setItem("bas_admin", JSON.stringify(data));
      toast.success("Access granted");
      navigate("/super-dashboard");
      return;
    }

    if (data.twofa_required) {
      setPendingToken(data.pending_token);
      setStep("code");
      return;
    }

    if (data.enroll_required) {
      setPendingToken(data.pending_token);
      try {
        const { data: setupData } = await admin2faSetup({ pending_token: data.pending_token });
        setQrDataUrl(setupData.qr_data_url);
        setSecret(setupData.secret);
        setStep("enroll");
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not load 2FA setup");
      }
      return;
    }

    // Unexpected shape — surface the raw message if any
    toast.error(data.message || "Unexpected server response");
  };

  // Called when admin2faVerify resolves (code step)
  const handleVerifySuccess = (data) => {
    localStorage.setItem("bas_admin", JSON.stringify(data));
    toast.success("Access granted");
    navigate("/super-dashboard");
  };

  // Called when admin2faConfirm resolves (enroll step)
  const handleEnrollConfirm = (data) => {
    setSession(data);
    setStep("recovery");
  };

  // Called when user clicks Continue on the recovery screen
  const handleRecoveryContinue = () => {
    localStorage.setItem("bas_admin", JSON.stringify(session));
    toast.success("2FA activated — access granted");
    navigate("/super-dashboard");
  };

  // Step header labels
  const stepLabel = {
    password: null,
    "change-password": "Set your password",
    code:     "Two-factor authentication",
    enroll:   "Set up two-factor authentication",
    recovery: "Save your recovery codes",
  }[step];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
               style={{ background: "#0079C1" }}>
            <LockIcon />
          </div>
          <h1 className="text-xl font-bold text-white">Super Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Meeticulous · Restricted access</p>
          {stepLabel && (
            <p className="text-xs text-orange-400 font-medium mt-2">{stepLabel}</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {step === "password" && (
            <PasswordStep onResult={handlePasswordResult} />
          )}

          {step === "change-password" && (
            <ChangePasswordStep
              changeToken={pwChangeToken}
              currentPassword={tempPassword}
              onDone={() => { setStep("password"); setPwChangeToken(null); setTempPassword(""); }}
            />
          )}

          {step === "code" && (
            <CodeStep
              pendingToken={pendingToken}
              onSuccess={handleVerifySuccess}
            />
          )}

          {step === "enroll" && (
            <EnrollStep
              qrDataUrl={qrDataUrl}
              secret={secret}
              pendingToken={pendingToken}
              onSuccess={handleEnrollConfirm}
            />
          )}

          {step === "recovery" && (
            <RecoveryStep
              codes={session?.recovery_codes}
              onContinue={handleRecoveryContinue}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Unauthorised access is prohibited and logged.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
