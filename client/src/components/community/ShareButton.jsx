import toast from 'react-hot-toast';
import { Share2 } from 'lucide-react';
import useReactionFx from './useReactionFx';

// Share plays its ripple on the press and then opens the sheet / copies the link. The
// share sheet is the slowest thing on the card, so the effect must not wait for it.
async function share(item) {
  const url = `${window.location.origin}${item.url}`;
  try {
    if (navigator.share) await navigator.share({ url, title: item.title || 'Meeticulous Community' });
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  } catch { /* share sheet dismissed */ }
}

export default function ShareButton({ item }) {
  const { trigger, fxProps, layers } = useReactionFx('send');
  return (
    <button
      type="button"
      onClick={() => { trigger(); share(item); }}
      {...fxProps}
      className="mt-btn mt-btn--ghost mt-btn--s mt-fx gap-2 font-medium"
    >
      {layers}
      <Share2 size={16} aria-hidden="true" />Share
    </button>
  );
}
