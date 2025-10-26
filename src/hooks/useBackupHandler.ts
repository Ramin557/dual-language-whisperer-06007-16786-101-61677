import { useEffect, useRef } from 'react';
import { useTranslatorStore } from '@/store/translatorStore';
import toast from 'react-hot-toast';

/**
 * Hook for automatic backup with debouncing
 * Saves content to localStorage after delay
 */
export const useBackupHandler = (delay = 5000) => {
  const { content } = useTranslatorStore();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!content) return;
    
    // Clear existing timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // Set new timer for backup
    timerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem('unity_translator_backup', content);
        localStorage.setItem('unity_translator_backup_time', new Date().toISOString());
        console.log('✅ Backup saved');
      } catch (error) {
        console.error('Backup failed:', error);
        toast.error('خطا در ذخیره پشتیبان');
      }
      timerRef.current = null;
    }, delay);

    // Cleanup
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, delay]);

  // Function to restore backup
  const restoreBackup = () => {
    try {
      const backup = localStorage.getItem('unity_translator_backup');
      const backupTime = localStorage.getItem('unity_translator_backup_time');
      
      if (backup && backupTime) {
        return { content: backup, time: backupTime };
      }
      return null;
    } catch (error) {
      console.error('Restore failed:', error);
      return null;
    }
  };

  return { restoreBackup };
};

export default useBackupHandler;
