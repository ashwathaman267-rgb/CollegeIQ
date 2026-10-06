import zlib from 'node:zlib';

import { unsupportedMedia } from '@/server/api/errors';

/**
 * Text extraction for uploaded documents.
 *
 * PDF and DOCX are handled locally so the platform works with no external API.
 * When a college later supplies an OCR/AI document API, implement
 * `DocumentExtractor` for it and register it in `extractText` — nothing else
 * changes.
 */
export interface DocumentExtractor {
  readonly name: string;
  supports(mimeType: string): boolean;
  extract(buffer: Buffer): Promise<string>;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // `pdf-parse` is required lazily: it pulls in pdfjs and must stay out of the
  // client bundle. The lib entry point avoids the package's debug self-test.
  const mod = (await import('pdf-parse/lib/pdf-parse.js').catch(() => import('pdf-parse'))) as unknown as {
    default?: (data: Buffer) => Promise<{ text: string; numpages: number }>;
  };
  const parse = mod.default ?? (mod as unknown as (d: Buffer) => Promise<{ text: string }>);
  const result = await parse(buffer);
  return result?.text ?? '';
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** Read a single entry out of a ZIP container without any native dependency. */
function readZipEntry(buffer: Buffer, wanted: string): Buffer | null {
  // Locate the End Of Central Directory record.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66_000); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const list: ZipEntry[] = [];

  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    list.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  const entry = list.find((e) => e.name === wanted);
  if (!entry) return null;

  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== 0x04034b50) return null;
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);
  return entry.method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:p[\s>]/g, '\n<w:p ')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const doc = readZipEntry(buffer, 'word/document.xml');
  if (!doc) throw unsupportedMedia('That Word document could not be read. Please export it as PDF.');
  return xmlToText(doc.toString('utf8'));
}

const EXTRACTORS: DocumentExtractor[] = [
  {
    name: 'pdf',
    supports: (mime) => mime === 'application/pdf',
    extract: extractPdf,
  },
  {
    name: 'docx',
    supports: (mime) =>
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword',
    extract: extractDocx,
  },
  {
    name: 'text',
    supports: (mime) => mime.startsWith('text/') || mime === 'application/json',
    extract: async (buffer) => buffer.toString('utf8'),
  },
];

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  const extractor = EXTRACTORS.find((e) => e.supports(mimeType));
  if (!extractor) {
    throw unsupportedMedia(
      `Cannot read "${mimeType}" files. Upload a PDF, DOCX, TXT or CSV instead.`,
    );
  }
  try {
    const text = await extractor.extract(buffer);
    return text.replace(/\u0000/g, '').trim();
  } catch (err) {
    if (err instanceof Error && err.name === 'AppError') throw err;
    throw unsupportedMedia(
      `We could not read text from that ${extractor.name.toUpperCase()} file. It may be scanned or password protected — try a text-based PDF.`,
    );
  }
}

export function isTextExtractable(mimeType: string) {
  return EXTRACTORS.some((e) => e.supports(mimeType));
}
