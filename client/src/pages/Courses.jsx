import { useState, useEffect } from "react";
import {
  getMyCourses, createCourse, updateCourse, deleteCourse,
} from "../services/api";
import { normalizePlan } from "../utils/themeUtils";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/FeatureContext";
import BackButton from "../components/common/BackButton";
import ThumbnailCropper from "../components/common/ThumbnailCropper";
import ComingSoonTeaser from "../components/dashboard/ComingSoonTeaser";
import { Link } from "react-router-dom";
import { Plus, Video, Trash2, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, buttonClasses, FormField, Input, Textarea,
  Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet, Fab, cn,
} from "../components/dashboard/ui";

const emptyForm = {
  title: "", description: "", price: "", thumbnail_url: "",
  lessons: [{ title: "", video_url: "" }],
};

// Blurred teaser behind the upgrade overlay for free-plan hosts.
const SAMPLE = [
  { title: "Lightroom Masterclass", meta: "8 lessons", price: "₹1,499" },
  { title: "Freelance Finance 101", meta: "5 lessons", price: "₹999" },
  { title: "Reels That Convert", meta: "12 lessons", price: "₹2,499" },
  { title: "Notion for Creators", meta: "6 lessons", price: "₹799" },
];

const Courses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Admin kill-switch (fail-open) + Pro gate. Creation is a paid-plan feature;
  // server enforces the same via planService.isFreeSlug.
  const coursesOn = useFeature("course_purchase");
  const isFreePlan = normalizePlan(user?.plan) === "free";
  const canCreate = !isFreePlan && coursesOn;

  const fetchCourses = async () => {
    setLoadError(false);
    try {
      const { data } = await getMyCourses();
      setCourses(data || []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load courses");
    }
  };
  useEffect(() => { fetchCourses(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setDirty(false); };
  const openEdit = (c) => {
    setForm({
      title: c.title, description: c.description || "",
      price: c.price == null ? "" : String(c.price),
      thumbnail_url: c.thumbnail_url || "",
      lessons: (c.course_lessons || []).length
        ? [...c.course_lessons].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((l) => ({ title: l.title, video_url: l.video_url }))
        : [{ title: "", video_url: "" }],
    });
    setEditingId(c.id); setShowForm(true); setDirty(false);
  };
  const doDiscard = () => { setShowForm(false); setEditingId(null); setDirty(false); setConfirmDiscard(false); };
  const handleCancel = () => { if (dirty) { setConfirmDiscard(true); return; } doDiscard(); };
  const handleChange = (f, v) => { setForm((s) => ({ ...s, [f]: v })); setDirty(true); };

  const setLesson = (i, field, v) => {
    setForm((s) => {
      const lessons = s.lessons.map((l, idx) => (idx === i ? { ...l, [field]: v } : l));
      return { ...s, lessons };
    });
    setDirty(true);
  };
  const addLesson = () => { setForm((s) => ({ ...s, lessons: [...s.lessons, { title: "", video_url: "" }] })); setDirty(true); };
  const removeLesson = (i) => { setForm((s) => ({ ...s, lessons: s.lessons.filter((_, idx) => idx !== i) })); setDirty(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lessons = form.lessons.filter((l) => l.title.trim() && l.video_url.trim());
    if (!lessons.length) { toast.error("Add at least one lesson with a title and video link"); return; }
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        price: form.price === "" || form.price == null ? 0 : Number(form.price),
        thumbnail_url: form.thumbnail_url,
        lessons,
      };
      if (editingId) {
        await updateCourse(editingId, payload);
        toast.success("Course updated!");
      } else {
        await createCourse(payload);
        toast.success("Course created!");
      }
      doDiscard();
      fetchCourses();
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.message || "Failed to save", data?.upgrade_required ? { duration: 5000 } : undefined);
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteCourse(confirmDelete.id);
      toast.success("Course deleted");
      setConfirmDelete(null);
      fetchCourses();
    } catch { toast.error("Failed to delete"); }
  };
  const handleToggle = async (c) => {
    try {
      // Re-send the existing lessons so activating doesn't wipe them.
      await updateCourse(c.id, {
        is_active: !c.is_active,
        lessons: (c.course_lessons || []).map((l) => ({ title: l.title, video_url: l.video_url })),
      });
      fetchCourses();
    } catch { toast.error("Failed to update"); }
  };

  // Free plan / kill-switch off → upgrade teaser (mirrors Products.jsx).
  if (!canCreate) {
    return (
      <div className="mx-auto max-w-4xl">
        <BackButton hasUnsavedChanges={false} />
        <PageHeader title="Video Courses" subtitle="Sell structured video courses — buy once, watch anytime." />
        {!coursesOn ? (
          <ComingSoonTeaser
            feature="courses"
            title="Sell video courses"
            blurb="Package your expertise into a structured video course and sell it from your profile — buy once, watch anytime. Coming to Pro."
          />
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-black/5">
            <ul aria-hidden className="pointer-events-none grid select-none gap-4 p-4 blur-[6px] sm:grid-cols-2">
              {SAMPLE.map((s) => (
                <li key={s.title} className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <div className="aspect-[16/9] bg-blush" />
                  <div className="p-4">
                    <h3 className="font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.meta}</p>
                    <p className="mt-2 font-bold text-maroon">{s.price}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="absolute inset-0 grid place-items-center bg-white/50 p-4 backdrop-blur-[2px]">
              <Card className="w-full max-w-sm text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blush text-maroon">
                  <Video className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mb-1 font-display font-bold text-maroon">Video Courses are a Pro feature</h3>
                <p className="mb-4 text-sm text-muted">
                  Package your knowledge into a structured video course and sell it from your profile. Upgrade to Pro to create and sell courses.
                </p>
                <Link to="/dashboard/upgrade" className={buttonClasses({ variant: "primary" })}>Upgrade to Pro</Link>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={dirty} />
      <PageHeader
        title="Video Courses"
        subtitle="Sell structured video courses — buy once, watch anytime."
        actions={!showForm ? (
          <Button className="hidden sm:inline-flex" onClick={openCreate}><Plus className="h-4 w-4" />Add Course</Button>
        ) : null}
      />

      {showForm && (
        <Card as="form" onSubmit={handleSubmit} className="mb-6 space-y-4">
          <h2 className="font-semibold text-ink">{editingId ? "Edit Course" : "New Course"}</h2>

          <FormField label="Title" htmlFor="crs-title" className="mb-0">
            <Input id="crs-title" required placeholder="e.g. The Complete Reels Course" value={form.title} onChange={(e) => handleChange("title", e.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="crs-desc" className="mb-0">
            <Textarea id="crs-desc" rows={3} placeholder="What will buyers learn?" value={form.description} onChange={(e) => handleChange("description", e.target.value)} />
          </FormField>
          <FormField label="Price (₹) — 0 for free" htmlFor="crs-price" className="mb-0">
            <Input id="crs-price" type="number" min={0} placeholder="0" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
          </FormField>
          <FormField label={<>Cover image — 16:9 <span className="font-normal text-ink/40">(optional)</span></>} className="mb-0">
            <ThumbnailCropper value={form.thumbnail_url} onChange={(url) => handleChange("thumbnail_url", url)} folder="products" />
          </FormField>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Lessons</p>
            <ul className="space-y-3">
              {form.lessons.map((l, i) => (
                <li key={i} className="rounded-lg border border-maroon/10 bg-blush/30 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                    <GripVertical className="h-4 w-4" /> Lesson {i + 1}
                    {form.lessons.length > 1 && (
                      <button type="button" onClick={() => removeLesson(i)} className="ml-auto text-rose-700" aria-label={`Remove lesson ${i + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Input className="mb-2" placeholder="Lesson title" value={l.title} onChange={(e) => setLesson(i, "title", e.target.value)} />
                  <Input type="url" placeholder="Video link (YouTube, Vimeo, Drive…)" value={l.video_url} onChange={(e) => setLesson(i, "video_url", e.target.value)} />
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addLesson}>
              <Plus className="h-4 w-4" />Add lesson
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : editingId ? "Save Changes" : "Create Course"}</Button>
            <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
          </div>
        </Card>
      )}

      {loadError && courses.length === 0 && !showForm ? (
        <ErrorState message="Couldn’t load your courses." onRetry={fetchCourses} />
      ) : courses.length === 0 && !showForm ? (
        <EmptyState icon={Video} title="No courses yet" description='Click "Add Course" to create your first video course.' />
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <Card as="li" key={c.id} padded={false} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} className="h-40 w-full object-cover sm:h-auto sm:w-28 sm:flex-shrink-0 sm:self-stretch" />}
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium text-ink">{c.title}</h3>
                        <Badge tone="neutral">{(c.course_lessons || []).length} lesson{(c.course_lessons || []).length !== 1 ? "s" : ""}</Badge>
                        <StatusBadge status={c.is_active ? "active" : "inactive"} label={c.is_active ? "Active" : "Inactive"} />
                      </div>
                      {c.description && <p className="mt-0.5 line-clamp-1 text-sm text-ink/40">{c.description}</p>}
                      <p className="mt-1 text-xs text-ink/40">{c.purchase_count} sold</p>
                    </div>
                    <p className="flex-shrink-0 font-semibold text-primary">{c.price === 0 ? "Free" : `₹${c.price}`}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 sm:flex sm:justify-start">
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => openEdit(c)}>Edit</Button>
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => handleToggle(c)}>{c.is_active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="danger-outline" className="min-h-11 sm:min-h-0" onClick={() => setConfirmDelete(c)}>Delete</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <ConfirmSheet open={!!confirmDelete} title="Delete course?" message={confirmDelete ? `"${confirmDelete.title}" and its lessons will be permanently deleted. This cannot be undone.` : ""} confirmLabel="Delete" danger onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
      <ConfirmSheet open={confirmDiscard} title="Discard changes?" message="Your unsaved changes will be lost." confirmLabel="Discard" danger onConfirm={doDiscard} onClose={() => setConfirmDiscard(false)} />

      {canCreate && !showForm && <Fab onClick={openCreate} icon={Plus} label="New course" iconOnly className="sm:hidden" />}
    </div>
  );
};

export default Courses;
