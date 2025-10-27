/**
 * File operations utilities (download, ZIP, hash, base64)
 */

/**
 * Safe file download - accepts both string and Blob
 */
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

/**
 * Create simple ZIP file (concatenated files with headers)
 */
export function createZipFile(files: Map<string, string>): Promise<Blob> {
  return new Promise((resolve) => {
    const parts: string[] = [];
    files.forEach((content, filename) => {
      parts.push(`\n========== ${filename} ==========\n`, content);
    });
    resolve(new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' }));
  });
}

/**
 * Generate output filename based on input
 */
export function generateOutputFileName(originalName: string, suffix: string): string {
  if (!originalName) return `output${suffix}.txt`;
  const dot = originalName.lastIndexOf('.');
  return dot > 0 ? originalName.slice(0, dot) + suffix + originalName.slice(dot) : originalName + suffix;
}

/**
 * Generate SHA-256 hash of content
 */
export async function hashContent(content: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Estimate file size in bytes
 */
export function estimateFileSize(content: string): number {
  return new Blob([content], { type: 'text/plain;charset=utf-8' }).size;
}

/**
 * Convert to base64 for localStorage
 */
export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Convert from base64
 */
export function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * Auto-save class with interval timer
 */
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
