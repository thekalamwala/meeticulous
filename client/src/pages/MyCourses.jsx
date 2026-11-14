import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPurchasedCourses } from "../services/api";
import BackButton from "../components/common/BackButton";
import { PageHeader, Card, EmptyState, ErrorState } from "../components/dashboard/ui";
import { Video } from "lucide-react";

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false); setLoading(true);
    try {
      const { data } = await getPurchasedCourses();
      setCourses(data || []);
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={false} />
      <PageHeader title="My Courses" subtitle="Video courses you've purchased." />
      {loading ? (
        <p className="py-10 text-center text-muted">Loading…</p>
      ) : error ? (
        <ErrorState message="Couldn’t load your courses." onRetry={load} />
      ) : courses.length === 0 ? (
        <EmptyState icon={Video} title="No courses yet" description="Courses you buy will appear here to watch anytime." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Card as="li" key={c.id} padded={false} className="overflow-hidden">
              <Link to={`/${c.profiles?.username}/course/${c.slug}`}>
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="grid aspect-video place-items-center bg-blush text-maroon"><Video className="h-8 w-8" /></div>
                )}
                <div className="p-4">
                  <h3 className="truncate font-medium text-ink">{c.title}</h3>
                  <p className="mt-0.5 text-sm text-ink/40">by {c.profiles?.name}</p>
                </div>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyCourses;
