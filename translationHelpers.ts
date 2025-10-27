کد کامل و نهایی بدون کوچک‌ترین کمبود:

```ts
// src/utils/translationHelpers.ts
// تمام توابع موردنیاز برای استخراج، ترجمه و فرمت RTL در Unity

import { ExtractedItem } from '@/store/translatorStore';
import { CONFIG, REGEX, RTL_EMBEDDING } from '@/config/constants';

// 1. حذف BOM و نرمال‌سازی خطوط
export function normalizeFileContent(content: string): string {
  return content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n');
}

// 2. استخراج ترم‌ها به‌صورت همزمان
export function extractTermsChunked(
  content: string,
  languageIndex: number = 0,
  onProgress?: (progress: number) => void
): Promise<ExtractedItem[]> {
  return new Promise((resolve) => {
    const lines = content.split('\n');
    const total = lines.length;
    const results: ExtractedItem[] = [];

    let currentTerm: ExtractedItem | null = null;
    let isFound = false;
    let bracketIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const termMatch = line.match(/string Term = "([^"]+)"/);
      if (termMatch) {
        if (currentTerm) results.push(currentTerm);
        currentTerm = { term: termMatch[1], originalText: '', dataLineIndex: undefined, linePrefix: '' };
        isFound = false;
        bracketIndex = -1;
      }

      const bracketMatch = line.match(/\[(\d+)\]/);
      if (bracketMatch && currentTerm) bracketIndex = parseInt(bracketMatch[1], 10);

      if (currentTerm && !isFound && bracketIndex === languageIndex) {
        const nextLine = lines[i + 1];
        if (nextLine) {
          const dataMatch = nextLine.match(/(\s*)(\d+\s+)?string data = "([^"]*)"/);
          if (dataMatch) {
            currentTerm.originalText = dataMatch[3] || '';
            currentTerm.dataLineIndex = i + 1;
            currentTerm.linePrefix = (dataMatch[1] || '') + (dataMatch[2] || '');
            isFound = true;
          }
        }
      }

      if (onProgress && i % 100 === 0) onProgress(Math.round((i / total) * 100));
    }

    if (currentTerm) results.push(currentTerm);
    resolve(results);
  });
}

// 3. کامل‌ترین تابع RTL – معکوس + Presentation Forms + بدون نیم‌فاصله
export function applyRTLFormatting(text: string): string {
  if (!text) return '';

  const normalized = text
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/أ|إ/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/\u200C/g, ''); // حذف نیم‌فاصله

  const presentationMap: Record<string, string> = {
    آ: 'ﺁ', ا: 'ﺎ', ب: 'ﺐ', پ: 'ﭗ', ت: 'ﺖ', ث: 'ﺚ',
    ج: 'ﺞ', چ: 'ﭻ', ح: 'ﺢ', خ: 'ﺧ', د: 'ﺩ', ذ: 'ﺫ',
    ر: 'ﺭ', ز: 'ﺯ', ژ: 'ﮊ', س: 'ﺲ', ش: 'ﺶ', ص: 'ﺺ',
    ض: 'ﺾ', ط: 'ﻂ', ظ: 'ﻆ', ع: 'ﻊ', غ: 'ﻎ', ف: 'ﻒ',
    ق: 'ﻖ', ک: 'ﻚ', گ: 'ﮒ', ل: 'ﻞ', م: 'ﻤ', ن: 'ﻦ',
    و: 'ﻭ', ه: 'ﻩ', ی: 'ﯿ',
    ' ': ' ', '!': '!', '?': '؟', '.': '.', ',': '،',
    ':': ':', ';': '؛', '"': '"', "'": "'",
    '(': ')', ')': '(', '[': ']', ']': '[',
    '{': '}', '}': '{',
    '-': '-', '–': '–', '—': '—', '/': '/', '\\': '\\',
    '+': '+', '=': '=', '*': '*', '×': '×', '÷': '÷',
    '%': '%', '٪': '٪', '‰': '‰', '€': '€', '$': '$',
    '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
    '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
  };

  const segments: Array<{ text: string; isRTL: boolean }> = [];
  let currentText = '';
  let isRTL = false;

  for (const char of normalized) {
    const charIsRTL = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);
    if (currentText === '') {
      currentText = char;
      isRTL = charIsRTL;
    } else if (charIsRTL === isRTL) {
      currentText += char;
    } else {
      segments.push({ text: currentText, isRTL });
      currentText = char;
      isRTL = charIsRTL;
    }
  }
  if (currentText) segments.push({ text: currentText, isRTL });

  const result = segments.map(segment => {
    if (segment.isRTL) {
      return [...segment.text]
        .reverse()
        .map(ch => presentationMap[ch] || ch)
        .join('');
    }
    return segment.text;
  }).join('');

  return '\u202E' + result; // RTL Override برای Unity
}

// 4. استخراج رشته‌ها از فایل Unity – چندفرمتی
export function extractStringsFromUnityFile(content: string): Array<{ term: string; data: string; category?: string }> {
  const lines = content.split(/\r?\n/);
  const results: Array<{ term: string; data: string; category?: string }> = [];
  let currentTerm: string | null = null;
  let lookingForData = false;
  let scanRange = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const termMatch = line.match(/string Term = "([^"]+)"/);
    if (termMatch) {
      currentTerm = termMatch[1];
      lookingForData = true;
      scanRange = 0;
      continue;
    }
    if (currentTerm && lookingForData && scanRange < 20) {
      const dataMatch = line.match(/string data = "([^"]*)"/);
      if (dataMatch) {
        const category = currentTerm.includes('/') ? currentTerm.split('/')[0] : undefined;
        results.push({ term: currentTerm, data: dataMatch[1], category });
        currentTerm = null;
        lookingForData = false;
        scanRange = 0;
      } else {
        scanRange++;
      }
    }
  }
  return results;
}

// 5. خروجی TXT فرمت Unity
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

// 6. تولید فایل‌های دسته‌بندی‌شده
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

// 7. ZIP ساده (فایل‌های پشت‌سرهم)
export function createZipFile(files: Map<string, string>): Promise<Blob> {
  return new Promise((resolve) => {
    const parts: string[] = [];
    files.forEach((content, filename) => {
      parts.push(`\n========== ${filename} ==========\n`, content);
    });
    resolve(new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' }));
  });
}

// 8. پارس چندفرمتی فایل‌های ترجمه
export function parseTranslations(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const trimmed = content.trim();

  // تلاش برای JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => { if (item?.term && item?.translation) map.set(String(item.term), String(item.translation)); });
        return map;
      }
      Object.entries(parsed).forEach(([k, v]) => map.set(String(k), String(v)));
      return map;
    } catch { /* ادامه به روش متنی */ }
  }

  // پارس متنی
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

// 9. اسکیپ کاراکترهای خاص
export function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// 10. اعمال ترجمه‌ها به محتوای اصلی
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

// 11. تولید محتوای معکوس‌شده با RTL
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

// 12. نام خروجی بر اساس ورودی
export function generateOutputFileName(originalName: string, suffix: string): string {
  if (!originalName) return `output${suffix}.txt`;
  const dot = originalName.lastIndexOf('.');
  return dot > 0 ? originalName.slice(0, dot) + suffix + originalName.slice(dot) : originalName + suffix;
}

// 13. دانلود ایمن فایل
export function downloadFile(data: string | Blob, filename: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// 14. خروجی CSV
export function exportToCSV(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const esc = (t: string) => (t.includes('"') || t.includes(',') || t.includes('\n')) ? `"${t.replace(/"/g, '""')}"` : t;
  const rows = data.map(it => [esc(it.term), esc(it.originalText), esc(translationMap.get(it.term) || '')].join(','));
  return 'Term,Original Text,Translation\n' + rows.join('\n');
}

// 15. فیلتر بر اساس جستجو
export function filterData(data: ExtractedItem[], query: string): ExtractedItem[] {
  if (!query.trim()) return data;
  const q = query.toLowerCase();
  return data.filter(it => it.term.toLowerCase().includes(q) || it.originalText.toLowerCase().includes(q));
}

// 16. شمارش ترجمه‌شده‌ها
export function countTranslated(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): number {
  return data.filter(it => translationMap.get(it.term)?.trim().length).length;
}

// 17. بررسی معتبر بودن فایل ورودی
export function isValidUnityFile(content: string): boolean {
  return /string\s+Term\s*=\s*"[^"]+"/m.test(content) &&
         /string\s+data\s*=\s*"[^"]*"/m.test(content);
}

// 18. حذف نظرات خط تکی و بلوکی برای پاک‌سازی قبل پردازش
export function stripComments(content: string): string {
  // حذف /* ... */
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // حذف // تا انتهای خط
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  return cleaned.trim();
}

// 19. استخراج زبان‌های موجود در فایل Unity
export function getAvailableLanguages(content: string): number[] {
  const lines = content.split(/\r?\n/);
  const langs = new Set<number>();
  lines.forEach(line => {
    const m = line.match(/\[(\d+)\]/);
    if (m) langs.add(parseInt(m[1], 10));
  });
  return Array.from(langs).sort((a, b) => a - b);
}

// 20. بررسی وجود ترجمه برای یک ترم خاص
export function hasTranslation(term: string, map: Map<string, string>): boolean {
  const t = map.get(term);
  return t !== undefined && t.trim().length > 0;
}

// 21. حذف ترجمه از Map (جهت Reset یا حذف دستی)
export function removeTranslation(term: string, map: Map<string, string>): boolean {
  return map.delete(term);
}

// 22. ادغام دو Map ترجمه (پیش‌فرض + کاربر) – اولویت با دومی
export function mergeTranslations(base: Map<string, string>, user: Map<string, string>): Map<string, string> {
  return new Map([...base, ...user]);
}

// 23. تولید گزارش سریع – تعداد کل، ترجمه‌شده، درصد
export function generateQuickReport(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { total: number; translated: number; percent: number } {
  const total = data.length;
  const translated = countTranslated(data, translationMap);
  const percent = total ? Math.round((translated / total) * 100) : 0;
  return { total, translated, percent };
}

// 24. خروجی JSON زیبا برای ذخیرهٔ کامل پروژه
export function exportToJSON(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const obj = data.map(it => ({
    term: it.term,
    originalText: it.originalText,
    translation: translationMap.get(it.term) || ''
  }));
  return JSON.stringify(obj, null, 2);
}

// 25. بارگذاری JSON ذخیره‌شده
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

// 26. مقایسه دو نگارش فایل Unity و گزارش تفاوت‌ها
export function diffUnityFiles(oldContent: string, newContent: string): {
  added: string[];
  removed: string[];
  unchanged: string[];
} {
  const oldTerms = new Set(extractStringsFromUnityFile(oldContent).map(t => t.term));
  const newTerms = new Set(extractStringsFromUnityFile(newContent).map(t => t.term));
  const added = [...newTerms].filter(t => !oldTerms.has(t));
  const removed = [...oldTerms].filter(t => !newTerms.has(t));
  const unchanged = [...oldTerms].filter(t => newTerms.has(t));
  return { added, removed, unchanged };
}

// 27. خروجی XLIF 1.2 (سیستم‌های مدیریت ترجمه)
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

// 28. اسکیپ XML برای XLIF
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 29. بررسی یکسان بودن دو محتوا (بدون توجه به ترتیب ترم‌ها)
export function areTranslationsEqual(
  contentA: string,
  contentB: string
): boolean {
  const mapA = new Map(extractStringsFromUnityFile(contentA).map(t => [t.term, t.data]));
  const mapB = new Map(extractStringsFromUnityFile(contentB).map(t => [t.term, t.data]));
  if (mapA.size !== mapB.size) return false;
  for (const [k, v] of mapA) if (mapB.get(k) !== v) return false;
  return true;
}

// 30. تولید هش SHA-256 از محتوای فایل برای چک‌سام
export async function hashContent(content: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 31. ذخیرهٔ خودکار با بازه زمانی (Auto-Save) – wrapper برای استفاده در UI
export class AutoSaver {
  private timer: number | null = null;
  constructor(
    private intervalMs: number,
    private saveFn: () => void
  ) {}
  start() {
    this.stop();
    this.timer = window.setInterval(this.saveFn, this.intervalMs);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

// 32. بررسی پشتیبانی فونت از کاراکتر خاص (تست سریع در بروزر)
export function isCharSupported(char: string, fontFamily = 'Tahoma'): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `48px ${fontFamily}`;
  const metrics = ctx.measureText(char);
  return metrics.width > 0;
}

// 33. تبدیل اعداد انگلیسی به فارسی درون رشته
export function convertNumbersToFarsi(str: string): string {
  return str.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
}

// 34. برعکس کردن سریع یک رشته (بدون تقسیم به RTL/LTR)
export function simpleReverse(str: string): string {
  return [...str].reverse().join('');
}

// 35. پاک‌سازی کامل حافظه‌ی موقت ترجمه‌ها (Reset)
export function clearTranslations(map: Map<string, string>): void {
  map.clear();
}

// 36. خروجی PO (Gettext) برای سیستم‌های دیگر
export function exportToPO(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  let po = '';
  data.forEach(it => {
    po += `#: ${it.term}\n`;
    po += `msgid "${escapeSpecialCharacters(it.originalText)}"\n`;
    po += `msgstr "${escapeSpecialCharacters(translationMap.get(it.term) || '')}"\n\n`;
  });
  return po;
}

// 37. بارگذاری PO و ادغام در Map
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

// 38. تولید گزارش CSV ساده در یک خط
export function oneLineCSVReport(data: ExtractedItem[], map: Map<string, string>): string {
  const total = data.length;
  const done = countTranslated(data, map);
  return `Total,${total},Translated,${done},Percent,${total ? Math.round((done / total) * 100) : 0}%`;
}

// 39. بررسی خالی بودن Map
export function isTranslationMapEmpty(map: Map<string, string>): boolean {
  return map.size === 0;
}

// 40. کلون عمیق یک Map ترجمه
export function cloneTranslationMap(map: Map<string, string>): Map<string, string> {
  return new Map(map);
}

// 41. محاسبه حجم تقریبی فایل خروجی بر حسب بایت
export function estimateFileSize(content: string): number {
  return new Blob([content], { type: 'text/plain;charset=utf-8' }).size;
}

// 42. تبدیل به base64 برای ذخیره در لوکال‌استوریج
export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// 43. بازگشت از base64
export function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

// 44. چاپ سریع در کنسول برای دیباگ
export function dumpToConsole(data: ExtractedItem[], map: Map<string, string>): void {
  console.table(data.map(it => ({ term: it.term, original: it.originalText, translation: map.get(it.term) || '' })));
}

// 45. بررسی وجود حروف خاص فارسی (جهت هشدار عدم پشتیبانی فونت)
export function containsPersianChars(str: string): boolean {
  return /[\u0600-\u06FF]/.test(str);
}

// 46. تبدیل فاصلهٔ عادی به نیم‌فاصله (برعکس عمل قبل)
export function addZwj(str: string): string {
  return str.replace(/می /g, 'می‌').replace(/ /g, '\u200B'); // نیم‌فاصله یا ZWNJ
}

// 47. حذف تمام فاصله‌ها و ZWJ/ZWNJ برای تست‌های واحد
export function removeAllSpaces(str: string): string {
  return str.replace(/\s|\u200C|\u200B/g, '');
}

// 48. تولید string رندوم برای تست
export function randomString(len = 8): string {
  return Math.random().toString(36).substring(2, 2 + len);
}

// 49. تبدیل به حروف کوچک انگلیسی برای key یکنواخت
export function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, ' ');
}

// 50. نهایی‌سازی – خروجی ماژول
const TranslationHelpers = {
  normalizeFileContent,
  extractTermsChunked,
  applyRTLFormatting,
  extractStringsFromUnityFile,
  generateTxtOutput,
  generateCategorizedFiles,
  createZipFile,
  parseTranslations,
  escapeSpecialCharacters,
  applyTranslations,
  generateReversedContent,
  generateOutputFileName,
  downloadFile,
  exportToCSV,
  filterData,
  countTranslated,
  isValidUnityFile,
  stripComments,
  getAvailableLanguages,
  hasTranslation,
  removeTranslation,
  mergeTranslations,
  generateQuickReport,
  exportToJSON,
  importFromJSON,
  diffUnityFiles,
  exportToXLIFF,
  areTranslationsEqual,
  hashContent,
  AutoSaver,
  isCharSupported,
  convertNumbersToFarsi,
  simpleReverse,
  clearTranslations,
  exportToPO,
  importFromPO,
  oneLineCSVReport,
  isTranslationMapEmpty,
  cloneTranslationMap,
  estimateFileSize,
  toBase64,
  fromBase64,
  dumpToConsole,
  containsPersianChars,
  addZwj,
  removeAllSpaces,
  randomString,
  normalizeKey
};

export default TranslationHelpers;
