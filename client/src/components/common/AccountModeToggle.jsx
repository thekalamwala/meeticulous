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
    `px-3 py-1 text-xs font-semibold rounded-full transition ${
      active ? "bg-[#960D32] text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
    }`;

  // Compact: one slim row. "Viewing as" + the two labels already say what it does,
  // so the explanatory paragraph (and the oversized card) are gone.
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <Repeat size={13} /> Viewing as
      </span>
      <div className="flex gap-1 rounded-full bg-gray-100 p-0.5">
        <button type="button" className={seg(mode === "hosting")} onClick={() => switchTo("hosting")}>
          Host
        </button>
        <button type="button" className={seg(mode === "traveling")} onClick={() => switchTo("traveling")}>
          Guest
        </button>
      </div>
    </div>
  );
};

export default AccountModeToggle;
