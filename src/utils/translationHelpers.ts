/**
 * Translation Helpers - Main export file
 * Re-exports all translation utilities for backward compatibility
 */

// RTL Formatting
export {
  applyRTLFormatting,
  convertNumbersToFarsi,
  simpleReverse,
  containsPersianChars,
  addZwj,
  removeAllSpaces,
  isCharSupported
} from './translation/rtl-formatting';

// Unity Parser
export {
  normalizeFileContent,
  extractTermsChunked,
  extractStringsFromUnityFile,
  isValidUnityFile,
  stripComments,
  getAvailableLanguages,
  diffUnityFiles,
  areTranslationsEqual
} from './translation/unity-parser';

// Translation I/O
export {
  escapeSpecialCharacters,
  parseTranslations,
  exportToCSV,
  exportToJSON,
  importFromJSON,
  exportToPO,
  importFromPO,
  exportToXLIFF,
  generateTxtOutput,
  generateCategorizedFiles,
  applyTranslations,
  generateReversedContent,
  oneLineCSVReport
} from './translation/translation-io';

// File Operations
export {
  downloadFile,
  createZipFile,
  generateOutputFileName,
  hashContent,
  estimateFileSize,
  toBase64,
  fromBase64,
  AutoSaver
} from './translation/file-operations';

// Translation Utils
export {
  filterData,
  countTranslated,
  hasTranslation,
  removeTranslation,
  mergeTranslations,
  generateQuickReport,
  isTranslationMapEmpty,
  cloneTranslationMap,
  clearTranslations,
  dumpToConsole,
  randomString,
  normalizeKey
} from './translation/translation-utils';

// Default export for compatibility
import * as rtlFormatting from './translation/rtl-formatting';
import * as unityParser from './translation/unity-parser';
import * as translationIO from './translation/translation-io';
import * as fileOps from './translation/file-operations';
import * as translationUtils from './translation/translation-utils';

const TranslationHelpers = {
  ...rtlFormatting,
  ...unityParser,
  ...translationIO,
  ...fileOps,
  ...translationUtils
};

export default TranslationHelpers;
