import { useState, useEffect } from "react";
import { adminGetSettings, adminUpdateSettings } from "../../services/api";
import toast from "react-hot-toast";
import { PageHeader, Card } from "../../components/admin/ui";

const AdminSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetSettings()
      .then((r) => setSettings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminUpdateSettings(settings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="text-center py-12 adm-t3">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Platform Settings" subtitle="Global configuration for Meeticulous." />

      <Card className="space-y-5">
        <div>
          <label className="block text-sm font-medium adm-t1 mb-1">
            Platform Name
          </label>
          <input
            type="text"
            className="fb-input"
            value={settings.platform_name || ""}
            onChange={(e) =>
              setSettings({ ...settings, platform_name: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium adm-t1 mb-1">
            Platform Fee (₹ flat, added to each booking)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            className="fb-input"
            value={settings.platform_fee ?? 10}
            onChange={(e) =>
              setSettings({
                ...settings,
                platform_fee: parseFloat(e.target.value) || 0,
              })
            }
          />
          <p className="text-xs adm-t3 mt-1">
            Percentage deducted from host earnings. Charged on top of the service price. Default: ₹10. Set 0 for no fee.
          </p>
        </div>

        <div className="flex items-center justify-between py-3 border-t adm-border">
          <div>
            <p className="text-sm font-medium adm-t1">Maintenance Mode</p>
            <p className="text-xs adm-t3">
              When enabled, only superadmins can access the platform.
            </p>
          </div>
          <button
            onClick={() =>
              setSettings({
                ...settings,
                maintenance_mode: !settings.maintenance_mode,
              })
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.maintenance_mode ? "bg-red-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.maintenance_mode ? "left-[26px]" : "left-0.5"}`}
            />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 w-full"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </Card>
    </div>
  );
};

export default AdminSettings;
