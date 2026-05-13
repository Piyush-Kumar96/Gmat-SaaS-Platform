/**
 * Many GMAT questions list Roman-numeral statements inline:
 *
 *   "...which of the following? I. A manager analyzes... II. A manager
 *   gathers... III. A manager takes action..."
 *
 * In the source HTML these were once on separate lines but the extractor's
 * `get_text(strip=True)` flattened them. We can't safely re-extract every
 * affected doc, so instead we re-introduce a `<br>` before each Roman-numeral
 * statement marker at render time.
 *
 * Heuristic gate: only run the transform when the text contains at least
 * two distinct markers (e.g. ` I. ` and ` II. `). This avoids rewriting
 * incidental occurrences like "Section I." or "Type II error".
 */

const MARKERS = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Returns text with `<br>` inserted before each Roman-numeral statement
 * marker. Safe to call on text that already contains HTML — the regex only
 * matches markers preceded by whitespace and followed by `. <space>`, so
 * existing tags are untouched.
 */
export function addStatementBreaks(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Confirm we're looking at a multi-statement list. The cheapest signal
  // is finding at least two of the markers as standalone " X. " tokens.
  let hits = 0;
  for (const m of MARKERS) {
    const re = new RegExp(`(?:^|\\s)${m}\\.\\s`);
    if (re.test(text)) hits++;
    if (hits >= 2) break;
  }
  if (hits < 2) return text;

  // Insert `<br><br>` before each marker that's preceded by whitespace.
  // Two breaks gives the visual gap between statements; CSS could also
  // handle this but `<br>` already passes our sanitizer allowlist.
  return text.replace(
    /(\S)\s+(I{1,3}|IV|V)\.\s+/g,
    (_match, prev, marker) => `${prev}<br><br>${marker}. `,
  );
}
