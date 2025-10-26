import { ExtractedItem } from '@/store/translatorStore';
import { CONFIG, REGEX, RTL_EMBEDDING } from '@/config/constants';

/**
 * Remove BOM and normalize line endings
 */
export function normalizeFileContent(content: string): string {
  return content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n');
}

/**
 * Extract terms - Simplified synchronous version
 */
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

            // Check for Term
            const termMatch = line.match(/string Term = "([^"]+)"/);
            if (termMatch) {
                if (currentTerm) {
                    results.push(currentTerm);
                    currentTerm = null;
                }
                currentTerm = { term: termMatch[1], originalText: '', dataLineIndex: undefined, linePrefix: '' };
                isFound = false;
                bracketIndex = -1;
            }

            // Check for Language index
            const bracketMatch = line.match(/\[(\d+)\]/);
            if (bracketMatch && currentTerm) {
                bracketIndex = parseInt(bracketMatch[1], 10);
            }

            // Check for Data line
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

            // Progress update
            if (onProgress && i % 100 === 0) {
                onProgress(Math.round((i / total) * 100));
            }
        }

        if (currentTerm) {
            results.push(currentTerm);
        }

        resolve(results);
    });
}

/**
 * Apply RTL formatting - Enhanced for Unity with BiDi markers
 */
export function applyRTLFormatting(text: string): string {
    if (!text) return text;

    // مرحله ۱: نرمال‌سازی حروف عربی به فارسی
    let normalized = text
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی')
        .replace(/ة/g, 'ه')
        .replace(/أ/g, 'ا')
        .replace(/إ/g, 'ا')
        .replace(/ؤ/g, 'و');

    // مرحله ۲: تقسیم متن به بخش‌های RTL و LTR
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
    if (currentText) {
        segments.push({ text: currentText, isRTL });
    }

    // مرحله ۳: معکوس کردن بخش‌های RTL و ترکیب نهایی
    const result = segments.map(segment => {
        if (segment.isRTL) {
            // معکوس کردن بخش RTL
            return [...segment.text].reverse().join('');
        }
        return segment.text;
    }).join('');

    // مرحله ۴: اضافه کردن کاراکترهای BiDi برای نمایش صحیح در یونیتی
    return '\u202B' + result + '\u202C';
}

/**
 * Extract strings from Unity file - supports multiple formats
 */
export function extractStringsFromUnityFile(content: string): Array<{ term: string; data: string; category?: string }> {
    const lines = content.split(/\r?\n/);
    const results: Array<{ term: string; data: string; category?: string }> = [];
    
    let currentTerm: string | null = null;
    let lookingForData = false;
    let scanRange = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for Term
        const termMatch = line.match(/string Term = "([^"]+)"/);
        if (termMatch) {
            currentTerm = termMatch[1];
            lookingForData = true;
            scanRange = 0;
            continue;
        }
        
        // If we have a term, look for data within next 20 lines
        if (currentTerm && lookingForData && scanRange < 20) {
            const dataMatch = line.match(/string data = "([^"]*)"/);
            if (dataMatch) {
                const category = currentTerm.includes('/') ? currentTerm.split('/')[0] : undefined;
                results.push({
                    term: currentTerm,
                    data: dataMatch[1],
                    category
                });
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

/**
 * Generate TXT output with Unity format
 */
export function generateTxtOutput(
    translations: Array<{ term: string; english: string; persian: string }>,
    reverseText: boolean = false
): string {
    const lines: string[] = [];
    
    translations.forEach((item, idx) => {
        const persianText = reverseText ? applyRTLFormatting(item.persian) : item.persian;
        
        lines.push(`[${idx}]`);
        lines.push(`0 TermData data`);
        lines.push(`  1 string Term = "${item.term}"`);
        lines.push(`[0]`);
        lines.push(`  1 string data = "${persianText}"`);
        lines.push(`EN: ${item.english}`);
        lines.push('');
    });
    
    return lines.join('\n');
}

/**
 * Generate categorized files by category
 */
export function generateCategorizedFiles(
    translations: Array<{ term: string; english: string; persian: string; category?: string }>,
    reverseText: boolean = false
): Map<string, string> {
    const fileMap = new Map<string, string>();
    const categorized = new Map<string, typeof translations>();
    
    // Group by category
    translations.forEach(item => {
        const cat = item.category || 'general';
        if (!categorized.has(cat)) {
            categorized.set(cat, []);
        }
        categorized.get(cat)!.push(item);
    });
    
    // Generate content for each category
    categorized.forEach((items, category) => {
        const content = generateTxtOutput(items, reverseText);
        fileMap.set(`${category}.txt`, content);
    });
    
    return fileMap;
}

/**
 * Create a simple ZIP-like file (concatenated files with headers)
 */
export function createZipFile(files: Map<string, string>): Promise<Blob> {
    return new Promise((resolve) => {
        const parts: string[] = [];
        
        files.forEach((content, filename) => {
            parts.push(`\n========== ${filename} ==========\n`);
            parts.push(content);
        });
        
        const blob = new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' });
        resolve(blob);
    });
}

/**
 * Parse translation file into Map
 * Supports multiple formats:
 * 1. Simple two-line format (term\ntranslation)
 * 2. #Term: / #Original: format
 * 3. CSV format
 * 4. JSON format
 */
export function parseTranslations(content: string): Map<string, string> {
  const translationMap = new Map<string, string>();
  const trimmed = content.trim();

  // Try JSON format first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item?.term && item?.translation) {
            translationMap.set(String(item.term), String(item.translation));
          }
        });
        return translationMap;
      } else if (typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, value]) => {
          translationMap.set(String(key), String(value));
        });
        return translationMap;
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Text-based parsing
  const lines = content.split(/\r?\n/).map(l => l.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    
    // Skip empty lines
    if (!currentLine) continue;

    // Format 1: #Term: / #Original: format
    if (currentLine.startsWith('#Term:')) {
      const term = currentLine.replace(/^#Term:\s*/i, '').trim();
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.startsWith('#Original:')) {
        const translation = nextLine.replace(/^#Original:\s*/i, '').trim();
        if (term && translation) {
          translationMap.set(term, translation);
        }
        i++; // Skip next line since we consumed it
        continue;
      }
    }

    // Format 2: CSV format "term","translation"
    const csvMatch = currentLine.match(/^"(.+)","(.+)"$/);
    if (csvMatch) {
      translationMap.set(csvMatch[1], csvMatch[2]);
      continue;
    }

    // Format 3: Simple two-line format (most common)
    // Current line is term, next line is translation
    const nextLine = lines[i + 1];
    if (nextLine && !nextLine.startsWith('#') && !nextLine.match(/^".*",".*"$/)) {
      // Make sure next line is not empty and not another term-like line
      if (nextLine.trim()) {
        translationMap.set(currentLine, nextLine);
        i++; // Skip next line since we consumed it
        continue;
      }
    }
  }

  return translationMap;
}

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
 * Apply translations to content safely
 */
export function applyTranslations(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { updated: string; count: number } {
  const lines = content.split('\n');
  let appliedCount = 0;

  data.forEach((item) => {
    const translation = translationMap.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const prefix = item.linePrefix || '';
      const escapedTranslation = escapeSpecialCharacters(translation);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedTranslation}"`;
      appliedCount++;
    }
  });

  return {
    updated: lines.join('\n'),
    count: appliedCount,
  };
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

  data.forEach((item) => {
    const translation = translationMap.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const rtlText = applyRTLFormatting(translation);
      const prefix = item.linePrefix || '';
      const escapedText = escapeSpecialCharacters(rtlText);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedText}"`;
    }
  });

  return lines.join('\n');
}

/**
 * Generate output filename based on input
 */
export function generateOutputFileName(originalName: string, suffix: string): string {
  if (!originalName) return `output${suffix}.txt`;
  const dotIndex = originalName.lastIndexOf('.');
  if (dotIndex > 0) {
    return originalName.slice(0, dotIndex) + suffix + originalName.slice(dotIndex);
  }
  return originalName + suffix;
}

/**
 * Safe file download - accepts both string and Blob
 */
export function downloadFile(data: string | Blob, filename: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Export to CSV with proper escaping
 */
export function exportToCSV(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const escapeCSV = (text: string): string => {
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = 'Term,Original Text,Translation\n';
  const rows = data.map((item) => {
    const translation = translationMap.get(item.term) || '';
    return [
      escapeCSV(item.term),
      escapeCSV(item.originalText),
      escapeCSV(translation),
    ].join(',');
  });

  return header + rows.join('\n');
}

/**
 * Get filtered data based on search query
 */
export function filterData(data: ExtractedItem[], query: string): ExtractedItem[] {
  if (!query.trim()) return data;
  
  const lowerQuery = query.toLowerCase();
  return data.filter((item) =>
    item.term.toLowerCase().includes(lowerQuery) ||
    item.originalText.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Count translated items
 */
export function countTranslated(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): number {
  return data.filter((item) => {
    const translation = translationMap.get(item.term);
    return translation && translation.trim().length > 0;
  }).length;
}
