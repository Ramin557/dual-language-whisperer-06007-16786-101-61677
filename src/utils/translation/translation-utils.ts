/**
 * General translation utility functions
 */

import { ExtractedItem } from '@/store/translatorStore';

/**
 * Filter data by search query
 */
export function filterData(data: ExtractedItem[], query: string): ExtractedItem[] {
  if (!query.trim()) return data;
  const q = query.toLowerCase();
  return data.filter(it => it.term.toLowerCase().includes(q) || it.originalText.toLowerCase().includes(q));
}

/**
 * Count translated items
 */
export function countTranslated(data: ExtractedItem[], translationMap: Map<string, string>): number {
  return data.filter(it => translationMap.get(it.term)?.trim().length).length;
}

/**
 * Check if term has translation
 */
export function hasTranslation(term: string, map: Map<string, string>): boolean {
  const t = map.get(term);
  return t !== undefined && t.trim().length > 0;
}

/**
 * Remove translation from map
 */
export function removeTranslation(term: string, map: Map<string, string>): boolean {
  return map.delete(term);
}

/**
 * Merge two translation maps (priority to second)
 */
export function mergeTranslations(base: Map<string, string>, user: Map<string, string>): Map<string, string> {
  return new Map([...base, ...user]);
}

/**
 * Generate quick report
 */
export function generateQuickReport(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { total: number; translated: number; percent: number } {
  const total = data.length;
  const translated = countTranslated(data, translationMap);
  const percent = total ? Math.round((translated / total) * 100) : 0;
  return { total, translated, percent };
}

/**
 * Check if translation map is empty
 */
export function isTranslationMapEmpty(map: Map<string, string>): boolean {
  return map.size === 0;
}

/**
 * Clone translation map
 */
export function cloneTranslationMap(map: Map<string, string>): Map<string, string> {
  return new Map(map);
}

/**
 * Clear all translations
 */
export function clearTranslations(map: Map<string, string>): void {
  map.clear();
}

/**
 * Dump translations to console for debugging
 */
export function dumpToConsole(data: ExtractedItem[], map: Map<string, string>): void {
  console.table(data.map(it => ({ 
    term: it.term, 
    original: it.originalText, 
    translation: map.get(it.term) || '' 
  })));
}

/**
 * Generate random string for testing
 */
export function randomString(len = 8): string {
  return Math.random().toString(36).substring(2, 2 + len);
}

/**
 * Normalize key for consistent lookup
 */
export function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, ' ');
}
