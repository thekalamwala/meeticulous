import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

  if (loading) return <div className="py-6 text-center"><PetalSpinner size={32} /></div>;

  return (
    <div className="space-y-3">
      {/* Current primary — a clean brand row */}
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-maroon/10 bg-cream px-4 py-3">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          {primary ? labelOf(primary) : <span className="font-normal text-neutral-400">Not set yet</span>}
        </p>
        {rules.locked && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500">
            <Lock className="h-3 w-3" strokeWidth={2.25} /> Fixed on your plan
          </span>
        )}
      </div>

      {rules.locked ? (
        <p className="text-xs text-neutral-500">
          Set by your plan. <Link to="/dashboard/upgrade?src=category" className="font-semibold text-maroon underline">Upgrade</Link> to change it.
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {rules.max === 1
              ? 'Tap a category to change your primary.'
              : `Choose up to ${rules.max}. Tap "Make primary" to set the main one.`}
          </p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map((c) => {
                    const on = selected.includes(c.slug);
                    const isPrimary = primary === c.slug;
                    return (
                      <div
                        key={c.slug}
                        className={`flex items-center justify-between gap-1 rounded-lg border-2 p-2.5 text-sm transition ${
                          on ? 'border-maroon bg-blush text-maroon' : 'border-neutral-200 hover:border-maroon/30'
                        }`}
                      >
                        <button type="button" onClick={() => toggle(c.slug)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                          {on && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                          <span className="truncate">{c.label}</span>
                        </button>
                        {rules.max > 1 && on && !isPrimary && (
                          <button type="button" onClick={() => makePrimary(c.slug)} className="shrink-0 text-[10px] font-medium text-maroon underline">Make primary</button>
                        )}
                        {isPrimary && <span className="shrink-0 rounded-full bg-maroon px-1.5 py-0.5 text-[10px] font-semibold text-white">Primary</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !primary}
            className="rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save category'}
          </button>
        </>
      )}
    </div>
  );
};

export default CategoriesSection;
