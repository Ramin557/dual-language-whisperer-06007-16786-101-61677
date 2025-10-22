interface ExtractedString {
  term: string;
  data: string;
  category?: string;
  itemNumber: string;
}

export const extractStringsFromUnityFile = (content: string): ExtractedString[] => {
  const lines = content.split("\n");
  const extracted: ExtractedString[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const itemMatch = line.match(/^\s*\[(\d+)\]\s*$/);
    
    if (!itemMatch) continue;
    
    const itemNumber = itemMatch[1];
    let term = "";
    let data = "";
    let category = "";

    // Scan forward to find Term and data
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const currentLine = lines[j];
      
      // Stop at next item
      if (j > i + 1 && currentLine.match(/^\s*\[\d+\]\s*$/)) {
        const currentIndent = currentLine.search(/\S/);
        const itemIndent = line.search(/\S/);
        if (currentIndent <= itemIndent) break;
      }

      // Extract Term (handles both full and simplified formats)
      const termMatch = currentLine.match(/(?:1\s+)?string\s+Term\s*=\s*"([^"]+)"/);
      if (termMatch) {
        term = termMatch[1];
        
        // Detect category from term name
        const termLower = term.toLowerCase();
        if (termLower.includes('menu') || termLower.includes('button')) {
          category = 'Menu';
        } else if (termLower.includes('setting') || termLower.includes('option')) {
          category = 'Settings';
        } else if (termLower.includes('tutorial') || termLower.includes('help')) {
          category = 'Tutorial';
        } else if (termLower.includes('game') || termLower.includes('play') || termLower.includes('level')) {
          category = 'Gameplay';
        } else {
          category = 'Misc';
        }
      }

      // Extract data (English string) - handles both formats
      // Format 1: Simplified format (direct data line after Term)
      const directDataMatch = currentLine.match(/(?:1\s+)?string\s+data\s*=\s*"([^"]*)"/);
      if (directDataMatch && term) {
        data = directDataMatch[1];
        break;
      }

      // Format 2: Full format (nested under [0])
      if (term && currentLine.match(/^\s*\[0\]\s*$/)) {
        for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
          const dataMatch = lines[k].match(/(?:1\s+)?string\s+data\s*=\s*"([^"]*)"/);
          if (dataMatch) {
            data = dataMatch[1];
            break;
          }
        }
        if (data) break;
      }
    }

    if (term && data) {
      extracted.push({
        term,
        data,
        category,
        itemNumber,
      });
    }
  }

  return extracted;
};

export const reversePersianText = (text: string): string => {
  return text.split('').reverse().join('');
};

export const generateTxtOutput = (
  translations: Array<{ term: string; english: string; persian: string; category?: string }>,
  reverseText: boolean = false
): string => {
  const lines: string[] = [];
  
  translations.forEach((item, idx) => {
    const persianText = reverseText ? reversePersianText(item.persian) : item.persian;
    
    lines.push(`[${idx}]`);
    lines.push(`0 TermData data`);
    lines.push(`1 string Term = "${item.term}"`);
    lines.push(`[0]`);
    lines.push(`1 string data = "${persianText}"`);
    lines.push(`EN: ${item.english}`);
    lines.push("");
  });

  return lines.join("\n");
};


export const generateCategorizedFiles = (
  translations: Array<{ term: string; english: string; persian: string; category?: string }>,
  reverseText: boolean = false
): Record<string, string> => {
  const categories = translations.reduce((acc, item) => {
    const cat = item.category || 'Misc';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof translations>);

  const files: Record<string, string> = {};

  Object.entries(categories).forEach(([category, items]) => {
    const lines: string[] = [];

    items.forEach((item, idx) => {
      const persianText = reverseText ? reversePersianText(item.persian) : item.persian;
      
      lines.push(`[${idx}]`);
      lines.push(`0 TermData data`);
      lines.push(`1 string Term = "${item.term}"`);
      lines.push(`[0]`);
      lines.push(`1 string data = "${persianText}"`);
      lines.push(`EN: ${item.english}`);
      lines.push("");
    });

    files[`${category}.txt`] = lines.join("\n");
  });

  return files;
};

export const createZipFile = async (files: Record<string, string>): Promise<Blob> => {
  // Create a simple ZIP file structure
  // For simplicity, we'll use a library-free approach with concatenated files
  // In production, you'd use a proper ZIP library
  
  let zipContent = "";
  
  Object.entries(files).forEach(([filename, content]) => {
    zipContent += `\n${"=".repeat(60)}\n`;
    zipContent += `FILE: ${filename}\n`;
    zipContent += `${"=".repeat(60)}\n`;
    zipContent += content;
    zipContent += "\n";
  });

  return new Blob([zipContent], { type: 'text/plain' });
};

export const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
