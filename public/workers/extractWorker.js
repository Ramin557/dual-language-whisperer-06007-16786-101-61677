/**
 * Web Worker for Unity I2 Translation Processing
 * Handles extraction and RTL formatting in background thread
 */

// Constants
const CONFIG = {
  CHUNK_SIZE: 1000,
  RTL_EMBEDDING: '\u202B',
};

const REGEX = {
  TERM: /string Term = "([^"]+)"/,
  BRACKET: /\[(\d+)\]/,
  DATA: /(\s*)(\d+\s+)?string data = "([^"]*)"/,
  BOM: /^\uFEFF/,
};

// Send ready signal
self.postMessage({ type: 'READY' });

// Message handler
self.onmessage = function(e) {
  const { type, content, langIndex, extractedData, translationsArray, map, requestId } = e.data;

  try {
    switch(type) {
      case 'EXTRACT':
        handleExtract(content, langIndex);
        break;
      case 'APPLY_TRANSLATIONS':
        handleApplyTranslations(content, extractedData, map);
        break;
      case 'GENERATE_REVERSED':
        handleGenerateReversed(content, extractedData, translationsArray, requestId);
        break;
      default:
        self.postMessage({ error: 'Unknown message type' });
    }
  } catch (error) {
    self.postMessage({ 
      error: error.message || 'Processing failed',
      requestId 
    });
  }
};

/**
 * Extract terms from content
 */
function handleExtract(content, targetIndex) {
  const lines = content.split('\n');
  const total = lines.length;
  const results = [];
  let currentTerm = null;
  let isFound = false;
  let bracketIndex = -1;

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    
    // Progress update every 100 lines
    if (i % 100 === 0) {
      self.postMessage({ progress: Math.round((i / total) * 100) });
    }
    
    // Match Term
    const termMatch = line.match(REGEX.TERM);
    if (termMatch) {
      if (currentTerm) results.push(currentTerm);
      currentTerm = { term: termMatch[1], originalText: '' };
      isFound = false;
      bracketIndex = -1;
    }
    
    // Match bracket index
    const bracketMatch = line.match(REGEX.BRACKET);
    if (bracketMatch && currentTerm) {
      bracketIndex = parseInt(bracketMatch[1], 10);
    }
    
    // Match data for target language
    if (currentTerm && !isFound && bracketIndex === targetIndex) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const dataMatch = nextLine.match(REGEX.DATA);
        if (dataMatch) {
          currentTerm.originalText = dataMatch[3];
          currentTerm.dataLineIndex = i + 1;
          currentTerm.linePrefix = (dataMatch[1] || '') + (dataMatch[2] || '');
          isFound = true;
        }
      }
    }
  }
  
  if (currentTerm) results.push(currentTerm);
  
  self.postMessage({ 
    extracted: results,
    progress: 100 
  });
}

/**
 * Apply translations to content
 */
function handleApplyTranslations(content, extractedData, translationsMap) {
  const lines = content.split('\n');
  const map = new Map(translationsMap);
  let appliedCount = 0;

  extractedData.forEach((item) => {
    const translation = map.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const prefix = item.linePrefix || '';
      const escapedTranslation = escapeSpecialCharacters(translation);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedTranslation}"`;
      appliedCount++;
    }
  });

  self.postMessage({
    type: 'APPLY_RESULT',
    updated: lines.join('\n'),
    count: appliedCount,
    map: translationsMap,
  });
}

/**
 * Generate reversed content with RTL formatting
 */
function handleGenerateReversed(content, extractedData, translationsArray, requestId) {
  const lines = content.split('\n');
  const map = new Map(translationsArray);

  extractedData.forEach((item) => {
    const translation = map.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const rtlText = applyRTLFormatting(translation);
      const prefix = item.linePrefix || '';
      const escapedText = escapeSpecialCharacters(rtlText);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedText}"`;
    }
  });

  self.postMessage({
    type: 'REVERSE_RESULT',
    requestId,
    updated: lines.join('\n'),
  });
}

/**
 * Apply RTL formatting with Unicode presentation forms
 * Converts Persian/Arabic text to isolated forms and reverses only the text segments
 * Preserves punctuation and special characters in their original positions
 */
function applyRTLFormatting(text) {
  // Normalize Arabic characters to Persian equivalents
  const normalizedMap = {
    'ك': 'ک',
    'ي': 'ی',
    'ة': 'ه',
    'أ': 'ا',
    'إ': 'ا',
    'ؤ': 'و',
  };
  
  // Mapping Persian/Arabic characters to their Unicode isolated presentation forms
  const presentationForms = {
    'ا': '\uFE8D', 'آ': '\uFE81', 'ب': '\uFE8F', 'پ': '\uFB56',
    'ت': '\uFE95', 'ث': '\uFE99', 'ج': '\uFE9D', 'چ': '\uFB7A',
    'ح': '\uFEA1', 'خ': '\uFEA5', 'د': '\uFEA9', 'ذ': '\uFEAB',
    'ر': '\uFEAD', 'ز': '\uFEAF', 'ژ': '\uFB8A', 'س': '\uFEB1',
    'ش': '\uFEB5', 'ص': '\uFEB9', 'ض': '\uFEBD', 'ط': '\uFEC1',
    'ظ': '\uFEC5', 'ع': '\uFEC9', 'غ': '\uFECD', 'ف': '\uFED1',
    'ق': '\uFED5', 'ک': '\uFED9', 'گ': '\uFB92', 'ل': '\uFEDD',
    'م': '\uFEE1', 'ن': '\uFEE5', 'و': '\uFEED', 'ه': '\uFEEB',
    'ی': '\uFEF1', 'ئ': '\uFE89',
  };
  
  // First normalize the text
  let normalized = text;
  for (const [arabic, persian] of Object.entries(normalizedMap)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), persian);
  }
  
  // Convert ALL characters to presentation forms first
  let withPresentationForms = '';
  for (const char of normalized) {
    if (presentationForms[char]) {
      withPresentationForms += presentationForms[char];
    } else {
      withPresentationForms += char;
    }
  }
  
  // Now split into segments: Persian/Arabic letters vs other characters
  const segments = [];
  let currentSegment = '';
  let isPersianSegment = false;
  
  for (const char of withPresentationForms) {
    const isPersianChar = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);
    
    if (currentSegment === '') {
      currentSegment = char;
      isPersianSegment = isPersianChar;
    } else if (isPersianChar === isPersianSegment) {
      currentSegment += char;
    } else {
      segments.push({ text: currentSegment, isPersian: isPersianSegment });
      currentSegment = char;
      isPersianSegment = isPersianChar;
    }
  }
  
  if (currentSegment) {
    segments.push({ text: currentSegment, isPersian: isPersianSegment });
  }
  
  // Process each segment: reverse only Persian segments
  const processed = segments.map(segment => {
    if (!segment.isPersian) {
      return segment.text; // Keep non-Persian text as is (like * or spaces)
    }
    
    // Reverse Persian segment (already in presentation forms)
    return Array.from(segment.text).reverse().join('');
  }).join('');
  
  return processed;
}

/**
 * Escape special characters for safe output
 */
function escapeSpecialCharacters(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
