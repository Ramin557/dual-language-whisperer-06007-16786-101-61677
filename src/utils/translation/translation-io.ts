/**
 * Translation import/export utilities (JSON, CSV, PO, XLIFF)
 */

import { ExtractedItem } from '@/store/translatorStore';
import { applyRTLFormatting } from './rtl-formatting';

/**
 * Escape special characters for safe output
 */
export function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape XML characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse translation file - supports multiple formats
 */
export function parseTranslations(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const trimmed = content.trim();

  // Try JSON format
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => { 
          if (item?.term && item?.translation) map.set(String(item.term), String(item.translation)); 
        });
        return map;
      }
      Object.entries(parsed).forEach(([k, v]) => map.set(String(k), String(v)));
      return map;
    } catch { /* Fall through to text parsing */ }
  }

  // Text-based parsing
  const lines = content.split(/\r?\n/).map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (!cur) continue;

    if (cur.startsWith('#Term:')) {
      const term = cur.replace(/^#Term:\s*/i, '');
      const next = lines[i + 1];
      if (next?.startsWith('#Original:')) {
        map.set(term, next.replace(/^#Original:\s*/i, ''));
        i++;
      }
      continue;
    }

    const csv = cur.match(/^"(.+)"\s*,\s*"(.+)"$/);
    if (csv) { map.set(csv[1], csv[2]); continue; }

    const next = lines[i + 1];
    if (next && !next.startsWith('#') && !next.match(/^".*",".*"$/)) {
      map.set(cur, next);
      i++;
    }
  }
  return map;
}

/**
 * Export to CSV format
 */
export function exportToCSV(data: ExtractedItem[], translationMap: Map<string, string>): string {
  const esc = (t: string) => (t.includes('"') || t.includes(',') || t.includes('\n')) ? `"${t.replace(/"/g, '""')}"` : t;
  const rows = data.map(it => [esc(it.term), esc(it.originalText), esc(translationMap.get(it.term) || '')].join(','));
  return 'Term,Original Text,Translation\n' + rows.join('\n');
}

/**
 * Export to JSON format
 */
export function exportToJSON(data: ExtractedItem[], translationMap: Map<string, string>): string {
  const obj = data.map(it => ({
    term: it.term,
    originalText: it.originalText,
    translation: translationMap.get(it.term) || ''
  }));
  return JSON.stringify(obj, null, 2);
}

/**
 * Import from JSON format
 */
export function importFromJSON(jsonStr: string): { terms: ExtractedItem[]; map: Map<string, string> } {
  const arr: { term: string; originalText: string; translation?: string }[] = JSON.parse(jsonStr);
  const items: ExtractedItem[] = [];
  const map = new Map<string, string>();
  arr.forEach(it => {
    items.push({ term: it.term, originalText: it.originalText, dataLineIndex: undefined, linePrefix: '' });
    if (it.translation) map.set(it.term, it.translation);
  });
  return { terms: items, map };
}

/**
 * Export to PO (Gettext) format
 */
export function exportToPO(data: ExtractedItem[], translationMap: Map<string, string>): string {
  let po = '';
  data.forEach(it => {
    po += `#: ${it.term}\n`;
    po += `msgid "${escapeSpecialCharacters(it.originalText)}"\n`;
    po += `msgstr "${escapeSpecialCharacters(translationMap.get(it.term) || '')}"\n\n`;
  });
  return po;
}

/**
 * Import from PO format
 */
export function importFromPO(poContent: string): Map<string, string> {
  const map = new Map<string, string>();
  const blocks = poContent.split(/\n\n+/);
  blocks.forEach(block => {
    const idMatch = block.match(/^msgid\s+"([^"]*)"/m);
    const strMatch = block.match(/^msgstr\s+"([^"]*)"/m);
    if (idMatch && strMatch && strMatch[1].trim().length > 0) {
      map.set(idMatch[1], strMatch[1]);
    }
  });
  return map;
}

/**
 * Export to XLIFF 1.2 format
 */
export function exportToXLIFF(
  data: ExtractedItem[],
  translationMap: Map<string, string>,
  sourceLang = 'en',
  targetLang = 'fa'
): string {
  let xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="unity" source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">
    <body>`;

  data.forEach(it => {
    xliff += `
      <trans-unit id="${it.term}">
        <source>${escapeXML(it.originalText)}</source>
        <target>${escapeXML(translationMap.get(it.term) || '')}</target>
      </trans-unit>`;
  });

  xliff += `
    </body>
  </file>
</xliff>`;
  return xliff;
}

/**
 * Generate Unity TXT output
 */
export function generateTxtOutput(
  translations: Array<{ term: string; english: string; persian: string }>,
  reverseText: boolean = false
): string {
  const lines: string[] = [];
  translations.forEach((item, idx) => {
    const persianText = reverseText ? applyRTLFormatting(item.persian) : item.persian;
    lines.push(
      `[${idx}]`,
      `0 TermData data`,
      `  1 string Term = "${item.term}"`,
      `[0]`,
      `  1 string data = "${persianText}"`,
      `EN: ${item.english}`,
      ''
    );
  });
  return lines.join('\n');
}

/**
 * Generate categorized files
 */
export function generateCategorizedFiles(
  translations: Array<{ term: string; english: string; persian: string; category?: string }>,
  reverseText: boolean = false
): Map<string, string> {
  const fileMap = new Map<string, string>();
  const categorized = new Map<string, typeof translations>();
  translations.forEach(item => {
    const cat = item.category || 'general';
    if (!categorized.has(cat)) categorized.set(cat, []);
    categorized.get(cat)!.push(item);
  });
  categorized.forEach((items, category) => {
    fileMap.set(`${category}.txt`, generateTxtOutput(items, reverseText));
  });
  return fileMap;
}

/**
 * Apply translations to Unity file content
 */
export function applyTranslations(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { updated: string; count: number } {
  const lines = content.split('\n');
  let count = 0;
  data.forEach(item => {
    const tr = translationMap.get(item.term);
    if (tr && item.dataLineIndex !== undefined) {
      const prefix = item.linePrefix || '';
      lines[item.dataLineIndex] = `${prefix}string data = "${escapeSpecialCharacters(tr)}"`;
      count++;
    }
  });
  return { updated: lines.join('\n'), count };
}

/**
 * Generate reversed content with RTL formatting
 */
export function generateReversedContent(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const lines = content.split('\n');
  data.forEach(item => {
    const tr = translationMap.get(item.term);
    if (tr && item.dataLineIndex !== undefined) {
      const rtl = applyRTLFormatting(tr);
      const prefix = item.linePrefix || '';
      lines[item.dataLineIndex] = `${prefix}string data = "${escapeSpecialCharacters(rtl)}"`;
    }
  });
  return lines.join('\n');
}

/**
 * Generate one-line CSV report
 */
export function oneLineCSVReport(data: ExtractedItem[], map: Map<string, string>): string {
  const total = data.length;
  const done = data.filter(it => map.get(it.term)?.trim().length).length;
  return `Total,${total},Translated,${done},Percent,${total ? Math.round((done / total) * 100) : 0}%`;
}
