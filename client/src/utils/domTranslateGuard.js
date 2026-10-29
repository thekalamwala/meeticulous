// Browser / in-app translation (Google Translate, and the Instagram / Facebook
// in-app browsers' auto-translate) rewrites the text nodes React owns. React
// 18's next commit then calls removeChild / insertBefore on a node the
// translator already moved, the DOM throws — "NotFoundError: ... not a child of
// this node" (WebKit: "The object can not be found here") — and because the
// throw happens during commit the whole tree unmounts into the
// RouteErrorBoundary "This page didn't load" card.
//
// This is the well-known React-vs-translation crash (facebook/react#17256) and
// it was our #1 mobile crash: ~650 boundary hits / 14 days, almost entirely
// Instagram in-app webviews + iOS Safari landing on the homepage and /be-a-sloth
// (our paid/social ad entry pages), all en_GB locale = auto-translate on.
//
// The fix is the standard one: make the two DOM methods React uses during
// reconciliation degrade to a no-op on a parent mismatch instead of throwing.
// React keeps rendering; the translated section may look slightly off, but the
// page survives instead of white-screening.
//
// ponytail: DOM-method shim — the real cause is third-party translation vs React
// 18, which we don't control. Upgrade path: drop this if React hardens
// reconciliation against foreign DOM mutation. Idempotent + SSR-safe.

let installed = false;

export default function installDomTranslateGuard() {
  if (installed || typeof Node === 'undefined' || !Node.prototype) return;
  installed = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild(child) {
    // Translator already reparented `child` → React's removal is a safe no-op.
    if (child && child.parentNode !== this) return child;
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore(newNode, referenceNode) {
    // Reference node moved out from under us → skip the insert instead of throw.
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.apply(this, arguments);
  };
}
