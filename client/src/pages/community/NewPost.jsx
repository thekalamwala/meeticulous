import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import ComposerForm from '../../components/community/ComposerForm';
import { SITE_URL } from '../../utils/seo';
import { TITLE_SUFFIX } from './CommunityLayout';

// Full-page composer (replaces the modal). Two columns: the form + a live preview
// of the feed card. Compose triggers across the community navigate here.
export default function NewPost() {
  const { user } = useAuth();
  const [params] = useSearchParams();

  // Direct hits by signed-out visitors go back to the feed, where compose handles login.
  if (user === null) return <Navigate to="/community" replace />;

  const kind = params.get('kind') === 'thread' ? 'thread' : (params.get('kind') || 'post');
  const spaceKey = params.get('space') || '';
  const heading = kind === 'thread' ? 'New thread' : 'New post';

  return (
    <main className="min-h-screen bg-cream pb-16">
      <Seo title={`${heading}${TITLE_SUFFIX}`} canonical={`${SITE_URL}/community/new`} robots="noindex,follow" />
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-5">
        <div className="mb-5 flex items-center gap-3">
          <Link to="/community" aria-label="Back to the community" className="mt-btn mt-btn--ghost mt-iconbtn">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-maroon">{heading}</h1>
        </div>
        <ComposerForm variant="page" defaultKind={kind} defaultSpaceKey={spaceKey} />
      </div>
    </main>
  );
}
