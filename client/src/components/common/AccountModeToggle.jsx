import { useNavigate } from "react-router-dom";
import { Repeat } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isHost } from "../../utils/roleRoutes";

// Dual-capability account switch (unified identity). Lives inside the profile
// ("settings") pages on BOTH sides — deliberately not in the navbar, so it's
// discoverable only by someone who owns both spaces. Renders NOTHING for a
// guest-only account (no is_host), which is the privacy contract: a pure guest
// never learns the host space exists, and vice-versa. Internal mode values stay
// 'hosting' / 'traveling' (v3.34); only the labels read "As a Host / As a Guest".
const AccountModeToggle = () => {
  const { user, mode, setMode } = useAuth();
  const navigate = useNavigate();

  // Gate on the host capability: only an account that owns both spaces sees this.
  if (!isHost(user)) return null;

  const switchTo = (next) => {
    if (next === mode) return;
    setMode(next);
    navigate(next === "hosting" ? "/dashboard" : "/user");
  };

  const seg = (active) =>
    `flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition ${
      active ? "bg-[#2E1065] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div className="bg-white border rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
        <Repeat size={13} /> Account mode
      </div>
      <p className="text-sm text-gray-500 mb-3">
        You own both a host and a guest space. Switch which one you're using.
      </p>
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100">
        <button type="button" className={seg(mode === "hosting")} onClick={() => switchTo("hosting")}>
          As a Host
        </button>
        <button type="button" className={seg(mode === "traveling")} onClick={() => switchTo("traveling")}>
          As a Guest
        </button>
      </div>
    </div>
  );
};

export default AccountModeToggle;
