// public/workers/worker.js

self.onmessage = function(e) {
    const { type, data, requestId } = e.data;

    if (type === 'EXTRACT_TERMS') {
        const terms = [];
        const lines = data.content.split('\n');
        let currentTerm = null;
        const targetIndex = data.languageIndex || 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const termMatch = line.match(/^#Term:\s*(.+)$/i);
            if (termMatch) {
                if (currentTerm) terms.push(currentTerm);
                currentTerm = { term: termMatch[1], originalText: '' };
            }
            const bracketMatch = line.match(/^#Language\[(\d+)\]$/i);
            if (bracketMatch && currentTerm) {
                const bracketIndex = parseInt(bracketMatch[1], 10);
                if (bracketIndex === targetIndex) {
                    const nextLine = lines[i + 1];
                    if (nextLine) {
                        const dataMatch = nextLine.match(/^(.*?)(?:string\s+data\s*=\s*"(.*)")?$/);
                        if (dataMatch) {
                            currentTerm.originalText = dataMatch[2] || '';
                            currentTerm.dataLineIndex = i + 1;
                            currentTerm.linePrefix = dataMatch[1] || '';
                        }
                    }
                }
            }
        }
        if (currentTerm) terms.push(currentTerm);

        self.postMessage({
            type: 'EXTRACT_RESULT',
            requestId,
            extracted: terms
        });
    }

    if (type === 'APPLY_TRANSLATIONS') {
        const { content, data, translationMap } = data;
        const lines = content.split('\n');
        let appliedCount = 0;

        data.forEach(item => {
            const translation = translationMap.get(item.term);
            if (translation && item.dataLineIndex !== undefined) {
                const prefix = item.linePrefix || '';
                const escapedTranslation = translation.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                lines[item.dataLineIndex] = `${prefix}string data = "${escapedTranslation}"`;
                appliedCount++;
            }
        });

        self.postMessage({
            type: 'APPLY_RESULT',
            requestId,
            updated: lines.join('\n'),
            count: appliedCount,
            map: Array.from(translationMap.entries())
        });
    }

    if (type === 'GENERATE_REVERSED') {
        const { content, data, translationMap } = data;
        const lines = content.split('\n');

        data.forEach(item => {
            const translation = translationMap.get(item.term);
            if (translation && item.dataLineIndex !== undefined) {
                // Apply RTL formatting
                let rtlText = translation
                    .replace(/ك/g, 'ک')
                    .replace(/ي/g, 'ی')
                    .replace(/ة/g, 'ه')
                    .replace(/أ/g, 'ا')
                    .replace(/إ/g, 'ا')
                    .replace(/ؤ/g, 'و');

                // Split into RTL and LTR segments
                const segments = [];
                let currentText = '';
                let isRTL = false;

                for (const char of rtlText) {
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

                // Reverse RTL segments
                const result = segments.map(segment => {
                    if (segment.isRTL) {
                        return [...segment.text].reverse().join('');
                    }
                    return segment.text;
                }).join('');

                const prefix = item.linePrefix || '';
                const escapedText = result.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                lines[item.dataLineIndex] = `${prefix}string data = "${escapedText}"`;
            }
        });

        self.postMessage({
            type: 'REVERSE_RESULT',
            requestId,
            reversed: lines.join('\n')
        });
    }
};
