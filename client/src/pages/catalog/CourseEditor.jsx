// Add / edit a video course on its own route, like services:
//   /dashboard/course/add-new     /dashboard/course/edit/:id
// Replaces the side-drawer editor on the Courses page. Same fields and calls.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { getMyCourses, createCourse, updateCourse, deleteCourse } from '../../services/api';
import { useFeature } from '../../context/FeatureContext';
import ThumbnailCropper from '../../components/common/ThumbnailCropper';
import { FormField, Input, Textarea, ConfirmSheet } from '../../components/dashboard/ui';
import { EditorPage, EditorSection, KeptError, KeptSkeleton, IconAction, quietBtn } from './KeptKit';

const emptyLesson = () => ({ title: '', video_url: '' });
const emptyForm = { title: '', description: '', price: '', thumbnail_url: '', lessons: [emptyLesson()] };

const fromRow = (c) => ({
  title: c.title, description: c.description || '',
  price: c.price == null ? '' : String(c.price),
  thumbnail_url: c.thumbnail_url || '',
  lessons: (c.course_lessons || []).length
    ? [...c.course_lessons].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((l) => ({ title: l.title, video_url: l.video_url }))
    : [emptyLesson()],
});

/** Creation is open on every plan (pricing v2 §4 item 1 — courses earn the
 *  `courses` commission rate instead), behind an admin kill-switch (fail-open). */
export function useCourseGate() {
  const coursesOn = useFeature('course_purchase');
  return { coursesOn, canCreate: coursesOn };
}

export default function CourseEditor() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { state } = useLocation();
  const backTo = state?.from || '/dashboard/courses';
  const { canCreate } = useCourseGate();

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(isEdit ? 'loading' : 'ready');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => {
    setStatus('loading');
    getMyCourses()
      .then(({ data }) => {
        const hit = (data || []).find((c) => String(c.id) === String(id));
        if (hit) { setForm(fromRow(hit)); setStatus('ready'); } else setStatus('missing');
      })
      .catch(() => setStatus('error'));
  };
  useEffect(() => { if (isEdit) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free plan / kill-switch: the list page shows the upgrade teaser instead.
  if (!canCreate) return <Navigate to="/dashboard/courses" replace />;

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));
  const setLesson = (i, field, v) => setForm((s) => ({ ...s, lessons: s.lessons.map((l, idx) => (idx === i ? { ...l, [field]: v } : l)) }));
  const addLesson = () => setForm((s) => ({ ...s, lessons: [...s.lessons, emptyLesson()] }));
  const removeLesson = (i) => setForm((s) => ({ ...s, lessons: s.lessons.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lessons = form.lessons.filter((l) => l.title.trim() && l.video_url.trim());
    if (!lessons.length) { toast.error('Add at least one lesson with a title and video link'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description,
        price: form.price === '' || form.price == null ? 0 : Number(form.price),
        thumbnail_url: form.thumbnail_url, lessons,
      };
      if (isEdit) { await updateCourse(id, payload); toast.success('Course updated!'); }
      else { await createCourse(payload); toast.success('Course created!'); }
      navigate(backTo);
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.message || 'Failed to save', data?.upgrade_required ? { duration: 5000 } : undefined);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try { await deleteCourse(id); toast.success('Course deleted'); navigate('/dashboard/courses'); }
    catch { toast.error('Failed to delete'); }
  };

  const page = (body) => (
    <EditorPage back={backTo} backLabel={backTo === '/dashboard/catalog' ? 'Catalog' : 'Courses'}
      title={isEdit ? (form.title.trim() || 'Edit course') : 'New course'}
      sub={isEdit ? 'Changes show on your page as soon as you save.' : 'Guests can buy it as soon as you save.'}
      formId="course-form" saving={saving} saveLabel={isEdit ? 'Save changes' : 'Create course'}
      onCancel={() => navigate(backTo)} onDelete={isEdit && status === 'ready' ? () => setConfirmDelete(true) : undefined}>
      {body}
    </EditorPage>
  );

  if (status === 'loading') return page(<KeptSkeleton rows={4} />);
  if (status === 'error') return page(<KeptError what="course" onRetry={load} />);
  if (status === 'missing') return page(<KeptError what="course (it may have been deleted)" onRetry={() => navigate('/dashboard/courses')} />);

  return page(<>
    <form id="course-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
      <EditorSection title="Details">
        <FormField label="Title" htmlFor="crs-title" className="mb-0">
          <Input id="crs-title" required placeholder="e.g. The Complete Reels Course" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="crs-desc" className="mb-0">
          <Textarea id="crs-desc" rows={4} placeholder="What will buyers learn?" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormField label="Price (₹) — 0 for free" htmlFor="crs-price" className="mb-0">
          <Input id="crs-price" type="number" inputMode="decimal" min={0} placeholder="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </FormField>
      </EditorSection>

      <EditorSection title="Cover image" sub="16:9. Optional — the card shows a course icon without one.">
        <ThumbnailCropper value={form.thumbnail_url} onChange={(url) => set('thumbnail_url', url)} folder="products" />
      </EditorSection>

      <EditorSection title="Lessons" sub="Each lesson is a title and a video link (YouTube, Vimeo, Drive…).">
        <ol className="flex flex-col gap-3">
          {form.lessons.map((l, i) => (
            <li key={i} className="rounded-[20px] bg-cream p-3 sm:p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13px] font-semibold text-muted">Lesson {i + 1}</span>
                {form.lessons.length > 1 && (
                  <span className="ml-auto"><IconAction icon={Trash2} danger label={`Remove lesson ${i + 1}`} onClick={() => removeLesson(i)} /></span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input aria-label={`Lesson ${i + 1} title`} placeholder="Lesson title" value={l.title} onChange={(e) => setLesson(i, 'title', e.target.value)} />
                <Input aria-label={`Lesson ${i + 1} video link`} type="url" placeholder="Video link" value={l.video_url} onChange={(e) => setLesson(i, 'video_url', e.target.value)} />
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={addLesson} className={quietBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add lesson</button>
      </EditorSection>
    </form>
    <ConfirmSheet open={confirmDelete} title="Delete course?"
      message={`"${form.title}" and its lessons will be permanently deleted. This cannot be undone.`}
      confirmLabel="Delete" danger onConfirm={doDelete} onClose={() => setConfirmDelete(false)} />
  </>);
}
