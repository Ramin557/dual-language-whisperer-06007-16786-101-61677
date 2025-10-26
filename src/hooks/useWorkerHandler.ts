import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslatorStore } from '@/store/translatorStore';
import type { ExtractedItem } from '@/store/translatorStore';

type Resolver = { 
  resolve: (v: string) => void; 
  reject: (e: Error) => void; 
  timeoutId: number 
};

/**
 * Hook for Web Worker-based processing
 * Provides better performance for large files
 */
export const useWorkerHandler = () => {
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<Map<number, Resolver>>(new Map());
  const nextRequestId = useRef<number>(1);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const {
    setLoading,
    setProgress,
    setExtractedData,
    setContent,
    setTranslationMap,
    extractedData,
    translationMap,
  } = useTranslatorStore();

  const [workerReady, setWorkerReady] = useState(false);

  // Safe initialization (lazy)
  const initWorker = useCallback(() => {
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = new Promise<void>((resolve, reject) => {
      try {
        // Use dynamic import for better bundling
        const worker = new Worker(new URL('../../public/workers/worker.js', import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (e) => {
          const { type, requestId, ...data } = e.data;

          if (type === 'EXTRACT_RESULT') {
            setExtractedData(data.extracted);
            setProgress(100);
            setLoading(false);
            toast.success(`${data.extracted.length.toLocaleString('fa-IR')} متن استخراج شد`);
          }

          if (type === 'APPLY_RESULT') {
            setContent(data.updated);
            setTranslationMap(new Map(data.map || []));
            setLoading(false);
            toast.success(`${data.count?.toLocaleString('fa-IR') ?? 0} ترجمه اعمال شد`);
          }

          if (type === 'REVERSE_RESULT') {
            const reqId = requestId;
            if (typeof reqId === 'number' && resolversRef.current.has(reqId)) {
              const r = resolversRef.current.get(reqId)!;
              clearTimeout(r.timeoutId);
              r.resolve(data.reversed);
              resolversRef.current.delete(reqId);
            }
            setLoading(false);
          }

          if (type === 'ERROR') {
            const reqId = requestId;
            if (typeof reqId === 'number' && resolversRef.current.has(reqId)) {
              const r = resolversRef.current.get(reqId)!;
              clearTimeout(r.timeoutId);
              r.reject(new Error(data.message));
              resolversRef.current.delete(reqId);
            }
            setLoading(false);
          }
        };

        worker.onerror = (error) => {
          console.error('Worker error:', error);
          toast.error('خطا در ورکر');
          setLoading(false);
          reject(error);
        };

        worker.postMessage({ type: 'INIT' });
        setWorkerReady(true);
        resolve();
      } catch (error) {
        console.error('Worker initialization failed:', error);
        setWorkerReady(false);
        reject(error);
      }
    });

    return initPromiseRef.current;
  }, [setExtractedData, setProgress, setContent, setTranslationMap, setLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Reject all pending resolvers
      for (const [, r] of resolversRef.current.entries()) {
        try { 
          r.reject(new Error('Component unmounted')); 
        } catch {}
        clearTimeout(r.timeoutId);
      }
      resolversRef.current.clear();

      if (workerRef.current) {
        try { 
          workerRef.current.terminate(); 
        } catch {}
        workerRef.current = null;
      }
      initPromiseRef.current = null;
    };
  }, []);

  // Safe postMessage wrapper
  const postMessage = useCallback(async (msg: any) => {
    await initWorker();
    try {
      workerRef.current?.postMessage(msg);
    } catch (err) {
      console.error('postMessage failed:', err);
      throw err;
    }
  }, [initWorker]);

  // Create download promise with requestId support
  const createDownloadPromise = useCallback(async (content: string, timeoutMs = 10000) => {
    await initWorker();
    return new Promise<string>((resolve, reject) => {
      if (!workerRef.current) return reject(new Error('Worker not ready'));

      const requestId = nextRequestId.current++;

      // Set timeout
      const timeoutId = window.setTimeout(() => {
        if (resolversRef.current.has(requestId)) {
          resolversRef.current.delete(requestId);
          reject(new Error('Worker timeout'));
        }
      }, timeoutMs);

      resolversRef.current.set(requestId, { resolve, reject, timeoutId });

      try {
        workerRef.current.postMessage({
          type: 'GENERATE_REVERSED',
          requestId,
          data: {
            content,
            data: extractedData,
            translationMap: Array.from(translationMap.entries()),
          },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        resolversRef.current.delete(requestId);
        reject(new Error('Worker communication failed'));
      }
    });
  }, [initWorker, extractedData, translationMap]);

  return {
    workerReady,
    initWorker,
    postMessage,
    createDownloadPromise,
  };
};

export default useWorkerHandler;
