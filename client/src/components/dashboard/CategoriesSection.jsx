import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Check, Lock } from 'lucide-react';
import { getCategories, hostGetCategories, hostUpdateCategories } from '../../services/api';
import { getCategoryRules, groupCategories } from '../../utils/categoryUtils';
import PetalSpinner from '../common/PetalSpinner';

// Plan-gated category management. Free = locked. Creator = swap 1. Pro = up to 3.
const CategoriesSection = ({ plan, onSaved }) => {
  const rules = getCategoryRules(plan);
  const [active, setActive] = useState([]);
  const [primary, setPrimary] = useState(null);
  const [selected, setSelected] = useState([]); // includes primary
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), hostGetCategories()])
      .then(([a, mine]) => {
        setActive(a.data || []);
        setPrimary(mine.data?.primary_category || null);
        setSelected(mine.data?.categories?.length ? mine.data.categories : (mine.data?.primary_category ? [mine.data.primary_category] : []));
      })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupCategories(active), [active]);
  const labelOf = (slug) => active.find((c) => c.slug === slug)?.label || slug;

  const toggle = (slug) => {
    if (rules.locked) return;
    setSelected((prev) => {
      if (prev.includes(slug)) {
        if (slug === primary) return prev; // can't remove the primary by toggle
        return prev.filter((s) => s !== slug);
      }
      if (rules.max === 1) { setPrimary(slug); return [slug]; } // single-cap = swap primary
      if (prev.length >= rules.max) { toast.error(`Your plan allows up to ${rules.max} categories`); return prev; }
      return [...prev, slug];
    });
  };

  const makePrimary = (slug) => {
    if (rules.locked) return;
    setPrimary(slug);
    setSelected((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await hostUpdateCategories({ primary_category: primary, categories: selected });
      if (data?.services_cleared > 0) {
        toast.success(
          `Profession updated. ${data.services_cleared} of your services ${data.services_cleared === 1 ? 'needs' : 'need'} a new category. Edit them to pick one.`,
          { duration: 6000 }
        );
      } else {
        toast.success('Categories saved');
      }
      onSaved?.(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save categories');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-gray-400"><PetalSpinner size={36} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-1">Your Primary Category</p>
        <p className="text-base font-semibold text-primary">{primary ? labelOf(primary) : 'Not set'}</p>
      </div>

      {rules.locked ? (
        <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Your plan keeps your category fixed. Upgrade, or <strong>contact admin</strong> to change it.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {rules.max === 1
              ? 'Tap a category to change your primary.'
              : `Choose up to ${rules.max}. Tap "Make primary" to set the main one.`}
          </p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map((c) => {
                    const on = selected.includes(c.slug);
                    const isPrimary = primary === c.slug;
                    return (
                      <div
                        key={c.slug}
                        className={`flex items-center justify-between gap-1 p-2.5 rounded border-2 text-sm ${
                          on ? 'border-primary bg-primary-light' : 'border-gray-200'
                        }`}
                      >
                        <button onClick={() => toggle(c.slug)} className="flex items-center gap-1.5 text-left flex-1 min-w-0">
                          {on && <Check className="w-3.5 h-3.5 shrink-0 text-primary" strokeWidth={3} />}
                          <span className="truncate">{c.label}</span>
                        </button>
                        {rules.max > 1 && on && !isPrimary && (
                          <button onClick={() => makePrimary(c.slug)} className="text-[10px] text-primary underline shrink-0">Make primary</button>
                        )}
                        {isPrimary && <span className="text-[10px] text-primary font-semibold shrink-0">Primary</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving || !primary}
            className="btn bg-primary text-white px-5 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save categories'}
          </button>
        </>
      )}
    </div>
  );
};

export default CategoriesSection;
