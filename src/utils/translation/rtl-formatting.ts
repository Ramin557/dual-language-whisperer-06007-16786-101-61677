/**
 * RTL Formatting utilities for Persian/Arabic text in Unity
 */

const PRESENTATION_MAP: Record<string, string> = {
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

/**
 * Apply RTL formatting with Presentation Forms for Unity
 */
export function applyRTLFormatting(text: string): string {
  if (!text) return '';

  const normalized = text
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/أ|إ/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/\u200C/g, ''); // حذف نیم‌فاصله

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
        .map(ch => PRESENTATION_MAP[ch] || ch)
        .join('');
    }
    return segment.text;
  }).join('');

  return '\u202E' + result; // RTL Override برای Unity
}

/**
 * Convert English numbers to Persian
 */
export function convertNumbersToFarsi(str: string): string {
  return str.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
}

/**
 * Simple reverse without RTL/LTR segmentation
 */
export function simpleReverse(str: string): string {
  return [...str].reverse().join('');
}

/**
 * Check if string contains Persian characters
 */
export function containsPersianChars(str: string): boolean {
  return /[\u0600-\u06FF]/.test(str);
}

/**
 * Add Zero-Width Joiner for Persian spacing
 */
export function addZwj(str: string): string {
  return str.replace(/می /g, 'می‌').replace(/ /g, '\u200B');
}

/**
 * Remove all spaces and joiners
 */
export function removeAllSpaces(str: string): string {
  return str.replace(/\s|\u200C|\u200B/g, '');
}

/**
 * Check if font supports specific character
 */
export function isCharSupported(char: string, fontFamily = 'Tahoma'): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `48px ${fontFamily}`;
  const metrics = ctx.measureText(char);
  return metrics.width > 0;
}
