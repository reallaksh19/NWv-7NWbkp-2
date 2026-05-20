/**
 * Sanitize HTML text by stripping tags and decoding common entities.
 * @param {string} value
 * @returns {string}
 */
export function sanitizeHtmlText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
