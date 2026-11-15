import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getCoursePublic, getCourseContent, createCourseOrder, verifyCoursePayment,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isValidHex } from "../utils/themeUtils";
import loadRazorpay from "../utils/loadRazorpay";
import toast from "react-hot-toast";
import { Play, Lock, CheckCircle } from "lucide-react";

// Only http(s) links are safe to embed / open.
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : null);

const CoursePage = () => {
  const { username, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null); // paywalled lessons, if access granted
  const [active, setActive] = useState(0);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const { data } = await getCoursePublic(username, slug);
      setCourse(data);
      if (user?.id) {
        try {
          const { data: c } = await getCourseContent(data.id);
          setContent(c);
        } catch { /* not purchased — show the buy card */ }
      }
    } catch {
      toast.error("Course not found");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [username, slug, user?.id]);

  const accent = isValidHex(course?.profiles?.theme_color) ? course.profiles.theme_color : "#960D32";
  const fee = Number(course?.platform_fee ?? 0);
  const gst = Number(course?.platform_fee_gst ?? 0);
  const total = course ? (course.total != null ? Number(course.total) : Number(course.price) + fee + gst) : 0;

  const handleBuy = async () => {
    if (!user?.id) {
      toast("Please log in to buy this course");
      navigate(`/login?next=${encodeURIComponent(`/${username}/course/${slug}`)}`);
      return;
    }
    const loaded = await loadRazorpay();
    if (!loaded) { toast.error("Payment gateway failed to load"); return; }
    setPaying(true);
    try {
      const { data: order } = await createCourseOrder({ course_id: course.id });
      const options = {
        key: order.key, amount: order.amount, currency: order.currency,
        name: "Meeticulous", description: course.title, order_id: order.razorpay_order_id,
        handler: async (resp) => {
          try {
            await verifyCoursePayment({
              course_id: course.id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("You now own this course!");
            setLoading(true);
            load();
          } catch { toast.error("Payment verification failed. Contact support."); }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: accent },
        modal: { ondismiss: () => { setPaying(false); toast("Payment cancelled.", { icon: "🫤" }); } },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r) => { setPaying(false); toast.error(r?.error?.description || "Payment failed."); });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start payment");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!course) return <div className="py-20 text-center text-gray-400">Course not found</div>;

  const host = course.profiles;
  const lessons = content ? content.course_lessons : course.course_lessons || [];
  const owned = !!content;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="app-container max-w-4xl py-8">
        <Link to={`/${username}`} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">← Back to {host?.name}'s profile</Link>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Main: player (owned) or cover + description */}
          <div>
            {owned ? (
              <div className="fb-card overflow-hidden">
                {safeUrl(lessons[active]?.video_url) ? (
                  <div className="aspect-video w-full bg-black">
                    <iframe title={lessons[active]?.title} src={safeUrl(lessons[active]?.video_url)} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <div className="grid aspect-video place-items-center bg-gray-100 text-gray-400">No video</div>
                )}
                <div className="p-4">
                  <h1 className="text-lg font-bold">{lessons[active]?.title}</h1>
                  {safeUrl(lessons[active]?.video_url) && (
                    <a href={safeUrl(lessons[active]?.video_url)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline" style={{ color: accent }}>Open in new tab</a>
                  )}
                </div>
              </div>
            ) : (
              <div className="fb-card overflow-hidden">
                {course.thumbnail_url && <div className="aspect-video w-full"><img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" /></div>}
                <div className="p-5">
                  <h1 className="text-xl font-bold">{course.title}</h1>
                  <p className="mt-1 text-sm text-gray-500">by {host?.name} · {course.lesson_count} lesson{course.lesson_count !== 1 ? "s" : ""} · {course.purchase_count} sold</p>
                  {course.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{course.description}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: lesson list + buy/own */}
          <div className="space-y-4">
            {!owned && (
              <div className="fb-card p-5">
                <p className="text-2xl font-bold" style={{ color: accent }}>{course.price === 0 ? "Free" : `₹${course.price}`}</p>
                {course.price > 0 && fee > 0 && <p className="text-xs text-gray-400">+ ₹{fee} platform fee + GST = ₹{total}</p>}
                <button onClick={handleBuy} disabled={paying} className="btn mt-4 w-full py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: accent }}>
                  {paying ? "Opening payment…" : course.price === 0 ? "Get this course" : `Buy for ₹${total}`}
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">Buy once · watch anytime</p>
              </div>
            )}
            {owned && (
              <div className="fb-card flex items-center gap-2 p-4 text-sm font-medium text-green-700">
                <CheckCircle className="h-5 w-5" /> You own this course
              </div>
            )}

            <div className="fb-card overflow-hidden">
              <p className="border-b px-4 py-3 text-sm font-semibold">Lessons</p>
              <ul>
                {lessons.map((l, i) => (
                  <li key={l.id || i}>
                    <button
                      disabled={!owned}
                      onClick={() => owned && setActive(i)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${owned ? "hover:bg-gray-50" : "cursor-default"} ${owned && active === i ? "bg-gray-50 font-medium" : ""}`}
                    >
                      {owned ? <Play className="h-4 w-4 flex-shrink-0" style={{ color: accent }} /> : <Lock className="h-4 w-4 flex-shrink-0 text-gray-300" />}
                      <span className="truncate">{l.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePage;
