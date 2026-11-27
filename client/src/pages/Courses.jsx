import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getMyCourses, updateCourse, deleteCourse } from "../services/api";
import BackButton from "../components/common/BackButton";
import ComingSoonTeaser from "../components/dashboard/ComingSoonTeaser";
import { Plus, Video } from "lucide-react";
import useFeatureFlags from "../hooks/useFeatureFlags";
import { useCourseGate } from "./catalog/CourseEditor";
import {
  KeptPage, KeptHeader, CardGrid, PhotoCard, CardSwitch, KeptEmpty,
  KeptError, KeptSkeleton, PinnedAction, pinnedBtn, primaryBtn,
} from "./catalog/KeptKit";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, buttonClasses,
  Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet, Fab,
} from "../components/dashboard/ui";

// Create and edit live on their own routes (catalog/CourseEditor):
//   /dashboard/course/add-new   /dashboard/course/edit/:id
const ADD = "/dashboard/course/add-new";
const editOf = (c) => `/dashboard/course/edit/${c.id}`;

// Blurred teaser behind the upgrade overlay for free-plan hosts.
const SAMPLE = [
  { title: "Lightroom Masterclass", meta: "8 lessons", price: "₹1,499" },
  { title: "Freelance Finance 101", meta: "5 lessons", price: "₹999" },
  { title: "Reels That Convert", meta: "12 lessons", price: "₹2,499" },
  { title: "Notion for Creators", meta: "6 lessons", price: "₹799" },
];

const Courses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fetched, setFetched] = useState(false); // first load finished (Kept skeleton)
  // Kept look (dashboard_v2). Same data and handlers; only the shell differs.
  const { flags } = useFeatureFlags();
  const kept = !!flags?.dashboard_v2;
  const { coursesOn, canCreate } = useCourseGate();

  const fetchCourses = async () => {
    setLoadError(false);
    try {
      const { data } = await getMyCourses();
      setCourses(data || []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load courses");
    } finally {
      setFetched(true);
    }
  };
  useEffect(() => { fetchCourses(); }, []);

  const openCreate = () => navigate(ADD);
  const openEdit = (c) => navigate(editOf(c));

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
  // Plan-gated body, shared by both looks.
  const lockedBody = (
      <>
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
      </>
  );
  if (!canCreate) {
    if (kept) {
      return (
        <KeptPage pinned={false}>
          <KeptHeader title="Courses" sub="Video lessons a guest buys once and watches any time." />
          {lockedBody}
        </KeptPage>
      );
    }
    return (
      <div className="mx-auto max-w-4xl">
        <BackButton hasUnsavedChanges={false} />
        <PageHeader title="Video Courses" subtitle="Sell structured video courses — buy once, watch anytime." />
        {lockedBody}
      </div>
    );
  }

  if (kept) {
    const priceOf = (c) => (Number(c.price) ? `₹${Number(c.price).toLocaleString("en-IN")}` : "Free");
    // Guest total comes from the server (guest_total, pricingEngine). Never computed here.
    const guestOf = (c) => (Number(c.guest_total) > Number(c.price) ? `Guests pay ₹${Number(c.guest_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : null);
    const live = courses.filter((c) => c.is_active).length;
    return (
      <KeptPage>
        <KeptHeader title="Courses"
          sub={!fetched ? "Loading your courses…" : courses.length ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} · ${live} on your page` : "Video lessons a guest buys once and watches any time."}
          action={<button type="button" onClick={openCreate} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add course</button>} />

        {!fetched ? <KeptSkeleton /> : loadError && courses.length === 0 ? (
          <KeptError what="courses" onRetry={fetchCourses} />
        ) : courses.length === 0 ? (
          <KeptEmpty icon={Video} title="No courses yet"
            sub="Teach once, sell many times. A course is a set of video lessons a guest buys and watches at their own pace."
            action={<button type="button" onClick={openCreate} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a course</button>} />
        ) : (
          // A basic card: cover, title, and only what we track (lessons, sales).
          <CardGrid label="Your courses">
            {courses.map((c) => {
              const n = (c.course_lessons || []).length;
              return (
                <PhotoCard key={c.id} onOpen={() => openEdit(c)} image={c.thumbnail_url} icon={Video}
                  title={c.title}
                  detail={[n ? `${n} ${n === 1 ? "lesson" : "lessons"}` : "No lessons yet", c.purchase_count ? `${Number(c.purchase_count).toLocaleString("en-IN")} sold` : null].filter(Boolean).join(" · ")}
                  price={priceOf(c)} note={guestOf(c)}
                  footer={<CardSwitch checked={!!c.is_active} onChange={() => handleToggle(c)} word={c.is_active ? "On your page" : "Hidden"}
                    label={`${c.is_active ? "Hide" : "Show"} ${c.title} on your page`} />} />
              );
            })}
          </CardGrid>
        )}

        <PinnedAction show={fetched && !(loadError && courses.length === 0)}>
          <button type="button" onClick={openCreate} className={pinnedBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a course</button>
        </PinnedAction>
      </KeptPage>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={false} />
      <PageHeader
        title="Video Courses"
        subtitle="Sell structured video courses — buy once, watch anytime."
        actions={<Button className="hidden sm:inline-flex" onClick={openCreate}><Plus className="h-4 w-4" />Add Course</Button>}
      />

      {loadError && courses.length === 0 ? (
        <ErrorState message="Couldn’t load your courses." onRetry={fetchCourses} />
      ) : courses.length === 0 ? (
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

      {canCreate && <Fab onClick={openCreate} icon={Plus} label="New course" iconOnly className="sm:hidden" />}
    </div>
  );
};

export default Courses;
