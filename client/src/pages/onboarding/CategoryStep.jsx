import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Check, X, Plus, Loader2 } from 'lucide-react';
import { getCategories, suggestCategory, saveOnboardingPersona } from '../../services/api';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import PetalSpinner from '../../components/common/PetalSpinner';

// Fallback if the API is unreachable — keeps onboarding usable offline.
const FALLBACK = [
  { slug: 'life-coach',        label: 'Life Coach',        group_label: 'Coaching & Consulting' },
  { slug: 'career-coach',      label: 'Career Coach',      group_label: 'Coaching & Consulting' },
  { slug: 'software-engineer', label: 'Software Engineer', group_label: 'Technology & Product' },
  { slug: 'psychologist',      label: 'Psychologist',      group_label: 'Health & Wellness' },
  { slug: 'language-tutor',    label: 'Language Tutor',    group_label: 'Education' },
  { slug: 'financial-advisor', label: 'Financial Advisor', group_label: 'Business Services' },
];

const CategoryStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const searchRef = useRef(null);

  const [categories, setCategories]   = useState([]);
  const [selected, setSelected]       = useState(null);   // slug string | null
  const [selectedLabel, setSelectedLabel] = useState(''); // display name for the chip
  const [isPending, setIsPending]     = useState(false);  // true when selected is a pending suggestion
  const [query, setQuery]             = useState('');
  const [fetching, setFetching]       = useState(true);
  const [adding, setAdding]           = useState(false);
  const [saving, setSaving]           = useState(false);

  // Load category list once
  useEffect(() => {
    getCategories()
      .then(({ data }) => setCategories(data?.length ? data : FALLBACK))
      .catch(() => setCategories(FALLBACK))
      .finally(() => setFetching(false));
  }, []);

  // Autofocus search when ready
  useEffect(() => {
    if (ready && !fetching && searchRef.current) {
      searchRef.current.focus();
    }
  }, [ready, fetching]);

  // Live-filtered list (case-insensitive substring)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, query]);

  // Whether the typed query has an exact match (case-insensitive)
  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true; // nothing typed — don't show Add row
    return categories.some((c) => c.label.toLowerCase() === q);
  }, [categories, query]);

  const showAddRow = query.trim().length >= 2 && !hasExactMatch;

  // Select a category by slug + label; clear pending badge
  const selectCategory = (catSlug, catLabel, pending = false) => {
    setSelected(catSlug);
    setSelectedLabel(catLabel);
    setIsPending(pending);
    setQuery('');
  };

  const clearSelection = () => {
    setSelected(null);
    setSelectedLabel('');
    setIsPending(false);
    if (searchRef.current) searchRef.current.focus();
  };

  // Add custom category via API, then auto-select it
  const handleAddCustom = async () => {
    const label = query.trim();
    if (label.length < 2) { toast.error('Enter at least 2 characters to add a category'); return; }
    setAdding(true);
    try {
      const { data } = await suggestCategory(label);
      // Add to local list if not already present
      setCategories((prev) =>
        prev.some((c) => c.slug === data.slug) ? prev : [...prev, { ...data, group_label: 'Custom' }]
      );
      selectCategory(data.slug, data.label, data.status === 'pending');
      toast.success(data.status === 'pending' ? 'Category submitted for review.' : 'Category added.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not add category');
    } finally {
      setAdding(false);
    }
  };

  const handleNext = async () => {
    if (!selected) { toast.error('Please pick your primary category'); return; }
    setSaving(true);
    try {
      // Use the persona batch writer (step = max(current, 3)) — NOT step 4.
      // A host reaching here via the PersonaStep escape hatch never saved a
      // persona, so they're still at step 2; a hard step-4 write was rejected
      // server-side as an illegal jump ("complete the previous step first").
      await saveOnboardingPersona(selected);
      navigate(`/vendor-register/${slug}/preview`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save category');
      setSaving(false);
    }
  };

  // ── Loading guard ───────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingStepper current={2} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <OnboardingStepper current={2} />

      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">What do you do?</h1>
        <p className="mt-2 text-sm text-gray-500">
          Pick the category that fits you. Add your own if it&apos;s not listed.
        </p>

        {/* Search box */}
        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            strokeWidth={2.5}
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showAddRow && !adding) handleAddCustom();
            }}
            placeholder="Search categories"
            autoComplete="off"
            className="fb-input w-full pl-10"
          />
        </div>

        {/* Selected chip */}
        {selected && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-light px-3 py-1 text-sm font-medium leading-none text-primary-cta">
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              {selectedLabel}
              {isPending && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary/70">
                  pending review
                </span>
              )}
              <button
                onClick={clearSelection}
                aria-label={`Remove ${selectedLabel}`}
                className="ml-0.5 text-primary/70 transition hover:text-primary"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </span>
          </div>
        )}

        {/* Matches list */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {fetching ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <PetalSpinner size={40} />
            </div>
          ) : (
            <>
              {filtered.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => selectCategory(cat.slug, cat.label)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition last:border-b-0 ${
                    selected === cat.slug
                      ? 'bg-primary-light font-semibold text-primary-cta'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {selected === cat.slug ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <span>{cat.label}</span>
                </button>
              ))}

              {/* "Add <query>" row — shown only when query has no exact match */}
              {showAddRow && (
                <button
                  onClick={!adding ? handleAddCustom : undefined}
                  disabled={adding}
                  data-testid="add-custom-row"
                  className="flex w-full items-center gap-3 border-b border-gray-100 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-800 transition last:border-b-0 hover:bg-amber-100 disabled:opacity-60"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={3} />
                  )}
                  <span>Add &ldquo;{query.trim()}&rdquo;</span>
                </button>
              )}

              {/* Empty state — no matches and not showing Add row */}
              {filtered.length === 0 && !showAddRow && (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  No categories match your search.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate(`/vendor-register/${slug}/category`)}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving || !selected}
            className="btn-primary px-7 py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> Saving…
              </span>
            ) : (
              'Continue →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryStep;
