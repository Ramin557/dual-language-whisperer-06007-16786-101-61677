/**
 * Unity file parsing and extraction utilities
 */

import { ExtractedItem } from '@/store/translatorStore';
import { REGEX } from '@/config/constants';

/**
 * Normalize file content - remove BOM and normalize line endings
 */
export function normalizeFileContent(content: string): string {
  return content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n');
}

/**
 * Extract terms from Unity file with progress tracking
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

/**
 * Validate Unity file format
 */
export function isValidUnityFile(content: string): boolean {
  return /string\s+Term\s*=\s*"[^"]+"/m.test(content) &&
         /string\s+data\s*=\s*"[^"]*"/m.test(content);
}

/**
 * Strip comments from Unity file
 */
export function stripComments(content: string): string {
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  return cleaned.trim();
}

/**
 * Get available language indices from Unity file
 */
export function getAvailableLanguages(content: string): number[] {
  const lines = content.split(/\r?\n/);
  const langs = new Set<number>();
  lines.forEach(line => {
    const m = line.match(/\[(\d+)\]/);
    if (m) langs.add(parseInt(m[1], 10));
  });
  return Array.from(langs).sort((a, b) => a - b);
}

/**
 * Compare two Unity file versions
 */
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

/**
 * Check if two Unity files have equal translations
 */
export function areTranslationsEqual(contentA: string, contentB: string): boolean {
  const mapA = new Map(extractStringsFromUnityFile(contentA).map(t => [t.term, t.data]));
  const mapB = new Map(extractStringsFromUnityFile(contentB).map(t => [t.term, t.data]));
  if (mapA.size !== mapB.size) return false;
  for (const [k, v] of mapA) if (mapB.get(k) !== v) return false;
  return true;
}
