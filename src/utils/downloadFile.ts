/**
 * Safe file download utility
 * Creates a blob and triggers download with automatic cleanup
 */
export function downloadFile(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
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
    // Cleanup after short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
