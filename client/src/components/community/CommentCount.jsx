import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import useReactionFx from './useReactionFx';

// The replies affordance. It navigates, so the jello is the only feedback the person
// gets before the next screen paints — it plays on the press, not on arrival.
export default function CommentCount({ to, count, label, onClick }) {
  const { trigger, fxProps, layers } = useReactionFx('jello');
  const body = (
    <>
      {layers}
      <MessageCircle size={16} aria-hidden="true" />{count}
    </>
  );
  const cls = 'mt-btn mt-btn--ghost mt-btn--s mt-fx gap-2 font-medium no-underline';
  if (!to) {
    return (
      <button type="button" onClick={() => { trigger(); onClick?.(); }} aria-label={label} {...fxProps} className={cls}>
        {body}
      </button>
    );
  }
  return (
    <Link to={to} onClick={trigger} aria-label={label} {...fxProps} className={cls}>
      {body}
    </Link>
  );
}
