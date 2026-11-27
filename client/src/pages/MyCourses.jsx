import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Video } from "lucide-react";
import { getPurchasedCourses } from "../services/api";
import { useRegisterRefresh } from "../components/dashboard/ui/refreshContext";
import { KeptError } from "./catalog/KeptKit";
import { GuestEmpty, LibraryHead, btnPrimary, ring } from "./guest/GuestKit";

// /user/courses — Library › Courses (Kept). Video courses the guest bought.
const MyCourses = () => {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => getPurchasedCourses()
    .then(({ data }) => { setCourses(data || []); setError(false); })
    .catch(() => setError(true)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  return (
    <div className="flex flex-col gap-6">
      <LibraryHead />
      {error && !courses ? <KeptError what="courses" onRetry={load} />
        : !courses ? (
          <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => <li key={i} className="aspect-[4/3] animate-pulse rounded-[24px] bg-white" />)}
          </ul>
        ) : courses.length === 0 ? (
          <GuestEmpty mascot="green" title="No courses yet" sub="Courses you buy will appear here to watch anytime."
            action={<Link to="/explore" className={btnPrimary}>Browse creators</Link>} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id} className="overflow-hidden rounded-[24px] bg-white">
                <Link to={`/${c.profiles?.username}/course/${c.slug}`} className={`block transition hover:bg-pink-50 hover:no-underline ${ring}`}>
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-pink-50 text-maroon"><Video className="h-8 w-8" strokeWidth={1.8} /></div>
                  )}
                  <div className="p-5">
                    <h2 className="mb-0 truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{c.title}</h2>
                    <p className="mb-0 mt-1 truncate text-[13px] text-muted">by {c.profiles?.name || "Host"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
};

export default MyCourses;
