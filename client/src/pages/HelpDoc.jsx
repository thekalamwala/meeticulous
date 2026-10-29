import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL, articleGraphJsonLd } from '../utils/seo';
import Markdown from '../components/common/Markdown';
import { getHelpDoc } from '../content/helpDocs';

/**
 * /help/docs/:slug — a single help article, rendered from docs/help/<slug>.md.
 * Unknown slugs redirect to the help index (only known slugs are prerendered).
 */

const HelpDoc = () => {
  const { slug } = useParams();
  const doc = getHelpDoc(slug);
  if (!doc) return <Navigate to="/help/docs" replace />;

  const canonical = `${SITE_URL}/help/docs/${doc.slug}`;
  // One resolved description string for both the meta tag and the schema, so the
  // meta description equals the schema description.
  const description = doc.excerpt || `${doc.title} — Meeticulous help.`;
  // Same trail as the BreadcrumbList JSON-LD below. Help docs carry no author or
  // dates, so — per "don't invent" — the graph omits the Person and date nodes.
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Help', path: '/help/docs' },
    { name: doc.title, path: `/help/docs/${doc.slug}` },
  ];

  return (
    <main className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Seo
        title={`${doc.title} — Help — Meeticulous`}
        description={description}
        image={ogCard('help')}
        canonical={canonical}
        jsonLd={articleGraphJsonLd({
          url: canonical,
          type: 'Article',
          headline: doc.title,
          description,
          image: ogCard('help'), // hand-made 1200x630 help card
          imageWidth: 1200,
          imageHeight: 630,
          breadcrumb: crumbs,
        })}
      />
      <div className="app-container py-8 sm:py-12 max-w-3xl">
        {/* Visible breadcrumb — matches the BreadcrumbList JSON-LD (crumbs). */}
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
            <li><Link to="/" className="hover:text-gray-700">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/help/docs" className="inline-flex items-center gap-1.5 hover:text-gray-700">
                <ArrowLeft size={15} /> Help
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="max-w-[18rem] truncate text-gray-700">{doc.title}</li>
          </ol>
        </nav>

        <article className="bg-white border rounded-2xl p-6 sm:p-8">
          <Markdown source={doc.body} />
        </article>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Still stuck?{' '}
            <Link to="/help" className="font-semibold text-[#0079C1] hover:underline">Contact support</Link>
            {' '}or{' '}
            <Link to="/help/docs" className="font-semibold text-[#0079C1] hover:underline">browse all articles</Link>.
          </p>
        </div>
      </div>
    </main>
  );
};

export default HelpDoc;
