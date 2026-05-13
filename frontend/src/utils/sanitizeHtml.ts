/**
 * Strict allowlist sanitizer for passage/argument HTML coming from the
 * question DB. We render passages via dangerouslySetInnerHTML so they can
 * preserve real GMAT formatting (`<b>` for boldface portions, `<mark>` for
 * highlighted spans). Everything else is stripped to plain text — no scripts,
 * iframes, event handlers, or styled inline content.
 *
 * Allowed tags: b, strong, i, em, mark, br, p, span, sup, sub, u
 * Allowed attrs on <span>/<mark>: class (so we can keep "highlight" if needed)
 */

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'MARK', 'BR', 'P', 'SPAN', 'SUP', 'SUB', 'U',
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  SPAN: new Set(['class']),
  MARK: new Set(['class']),
};

const sanitizeNode = (node: Node, parent: Node) => {
  if (node.nodeType === Node.TEXT_NODE) return;

  if (node.nodeType !== Node.ELEMENT_NODE) {
    parent.removeChild(node);
    return;
  }

  const el = node as Element;
  const tag = el.tagName;

  if (!ALLOWED_TAGS.has(tag)) {
    // Replace disallowed element with its children, preserving their text.
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    return;
  }

  // Strip all attributes except the per-tag allowlist.
  const allowed = ALLOWED_ATTRS_BY_TAG[tag] || new Set<string>();
  for (const attr of Array.from(el.attributes)) {
    if (!allowed.has(attr.name)) el.removeAttribute(attr.name);
  }

  // Recurse into children.
  for (const child of Array.from(el.childNodes)) {
    sanitizeNode(child, el);
  }
};

export const sanitizeHtml = (html: string | undefined | null): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return '';
  for (const child of Array.from(root.childNodes)) sanitizeNode(child, root);
  return root.innerHTML;
};
