import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Make a list page answer its own ".../add-new" route, the way services have
 * /dashboard/service/add-new: opening the route opens the page's existing
 * create form, once the page knows the host may create (`ready`). When the form
 * closes (saved or cancelled), the URL goes back to the list so a refresh or a
 * back-swipe doesn't reopen it. Plan gates stay with the page: if `ready` never
 * becomes true, the page just shows its normal state (upsell, teaser).
 */
export default function useAddNewRoute({ open, ready, formOpen, listPath }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const wantsNew = pathname.endsWith('/add-new');
  const opened = useRef(false);
  const shown = useRef(false); // the form has actually rendered open

  useEffect(() => {
    if (wantsNew && ready && !opened.current) {
      opened.current = true;
      open();
    }
  }, [wantsNew, ready, open]);

  // Only a form that was SEEN open can close. When `ready` is already true on the
  // first commit, both effects run in that same commit: the one above calls
  // open(), and this one still holds the stale formOpen=false — which used to
  // read as "closed" and bounce straight back to the list (2026-11-27 bug).
  useEffect(() => {
    if (formOpen) { shown.current = true; return; }
    if (wantsNew && shown.current) {
      opened.current = false;
      shown.current = false;
      navigate(listPath, { replace: true });
    }
  }, [wantsNew, formOpen, listPath, navigate]);

  return wantsNew;
}

/**
 * `?edit=<id>` on a list page opens that item's edit form once the list has
 * loaded (the Catalog links products and courses this way). The param is then
 * dropped so closing the form doesn't reopen it. An unknown id does nothing.
 */
export function useEditParam(items, openEdit) {
  const [params, setParams] = useSearchParams();
  const id = params.get('edit');
  useEffect(() => {
    if (!id || !Array.isArray(items) || items.length === 0) return;
    const hit = items.find((i) => String(i.id) === id);
    if (hit) openEdit(hit);
    const next = new URLSearchParams(params);
    next.delete('edit');
    setParams(next, { replace: true });
  }, [id, items]); // eslint-disable-line react-hooks/exhaustive-deps
}
