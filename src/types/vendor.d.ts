/**
 * Ambient types for untyped third-party modules.
 *
 * `pdf-parse` ships no declarations, and its root import must be avoided when
 * bundling for the server (it runs a debug harness on import), so CampusIQ
 * loads `pdf-parse/lib/pdf-parse.js` directly.
 */

interface PdfParseResult {
  /** Extracted plain text. */
  text: string;
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: unknown;
  version: string;
}

type PdfParseFn = (
  data: Buffer | Uint8Array,
  options?: { pagerender?: unknown; max?: number; version?: string },
) => Promise<PdfParseResult>;

declare module 'pdf-parse' {
  const pdfParse: PdfParseFn;
  export default pdfParse;
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: PdfParseFn;
  export default pdfParse;
}
