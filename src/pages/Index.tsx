import { useRef, useMemo, useCallback, useState } from 'react';
import { FileText, Upload, Download, Search, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslatorStore } from '@/store/translatorStore';
import { VirtualizedPreview } from '@/components/VirtualizedPreview';
import { LiveTranslationPreview } from '@/components/LiveTranslationPreview';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useFileValidator } from '@/hooks/useFileValidator';
import { useBackupHandler } from '@/hooks/useBackupHandler';
import { useWorkerHandler } from '@/hooks/useWorkerHandler';
import {
  extractTermsChunked,
  normalizeFileContent,
  parseTranslations,
  applyTranslations,
  generateReversedContent,
  generateOutputFileName,
  downloadFile,
  exportToCSV,
  filterData,
  countTranslated,
} from '@/utils/translationHelpers';
import { CONFIG } from '@/config/constants';

export default function Index() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { validateFile, validateContent } = useFileValidator();
  
  // Worker mode toggle (optional performance boost)
  const [useWorkerMode, setUseWorkerMode] = useState(false);
  const { workerReady, postMessage, createDownloadPromise } = useWorkerHandler();
  
  // Automatic backup
  const { restoreBackup } = useBackupHandler();

  const {
    content,
    fileName,
    extractedData,
    translationMap,
    isLoading,
    progress,
    searchQuery,
    languageIndex,
    setContent,
    setFileName,
    setExtractedData,
    setTranslationMap,
    setLoading,
    setProgress,
    setSearchQuery,
    setLanguageIndex,
  } = useTranslatorStore();

  // Memoized filtered data
  const filteredData = useMemo(
    () => filterData(extractedData, searchQuery),
    [extractedData, searchQuery]
  );

  // Memoized translation count
  const translatedCount = useMemo(
    () => countTranslated(extractedData, translationMap),
    [extractedData, translationMap]
  );

  // Handle file upload
  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file || !validateFile(file)) return;

      setLoading(true);
      setProgress(0);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const rawContent = event.target?.result as string;
          if (!validateContent(rawContent)) {
            setLoading(false);
            return;
          }

          const normalizedContent = normalizeFileContent(rawContent);
          setContent(normalizedContent);

          const extracted = await extractTermsChunked(
            normalizedContent,
            languageIndex,
            setProgress
          );

          if (extracted.length === 0) {
            toast.error('هیچ متنی برای زبان انتخابی یافت نشد');
          } else {
            toast.success(`${extracted.length.toLocaleString('fa-IR')} متن استخراج شد`);
          }

          setExtractedData(extracted);
        } catch (error) {
          console.error('Error processing file:', error);
          toast.error('خطا در پردازش فایل');
        } finally {
          setLoading(false);
          setProgress(0);
        }
      };

      reader.onerror = () => {
        toast.error('خطا در خواندن فایل');
        setLoading(false);
      };

      reader.readAsText(file, 'UTF-8');
    },
    [validateFile, validateContent, languageIndex, setContent, setExtractedData, setFileName, setLoading, setProgress]
  );

  // Handle translation import
  const handleImport = useCallback(
    async (file: File | null) => {
      if (!file || !validateFile(file)) return;

      setLoading(true);
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const importedContent = event.target?.result as string;
          if (!importedContent?.trim()) {
            toast.error('فایل خالی است');
            setLoading(false);
            return;
          }

          const newTranslationMap = parseTranslations(importedContent);
          if (newTranslationMap.size === 0) {
            toast.error('هیچ ترجمه‌ای در فایل یافت نشد');
            setLoading(false);
            return;
          }

          // Show parsing stats
          console.log('📥 Parsed translations:', newTranslationMap.size);
          console.log('Sample terms:', Array.from(newTranslationMap.keys()).slice(0, 3));

          const { updated, count } = applyTranslations(content, extractedData, newTranslationMap);
          
          if (count === 0) {
            toast.error(`${newTranslationMap.size} ترجمه خوانده شد ولی هیچکدام با Term های فایل مطابقت نداشت`);
            console.warn('❌ No matches found. Check if terms match exactly.');
            console.log('Extracted terms sample:', extractedData.slice(0, 3).map(d => d.term));
          } else {
            setContent(updated);
            setTranslationMap(newTranslationMap);
            toast.success(`${count.toLocaleString('fa-IR')} از ${newTranslationMap.size} ترجمه اعمال شد`);
          }
        } catch (error) {
          console.error('Error importing translations:', error);
          toast.error('خطا در ایمپورت ترجمه‌ها');
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error('خطا در خواندن فایل');
        setLoading(false);
      };

      reader.readAsText(file, 'UTF-8');
    },
    [validateFile, content, extractedData, setContent, setTranslationMap, setLoading]
  );

  // Export functions
  const handleExportTerms = useCallback(() => {
    if (!extractedData.length) return;
    const exportContent = extractedData.map((item) => `${item.term}\n${item.originalText}`).join('\n\n');
    downloadFile(exportContent, generateOutputFileName(fileName, '_Terms'));
    toast.success(`${extractedData.length.toLocaleString('fa-IR')} متن صادر شد`);
  }, [extractedData, fileName]);

  const handleExportJSON = useCallback(() => {
    if (!extractedData.length) return;
    const jsonData = JSON.stringify(extractedData, null, 2);
    downloadFile(jsonData, generateOutputFileName(fileName, '.json'));
    toast.success('فایل JSON صادر شد');
  }, [extractedData, fileName]);

  const handleExportCSV = useCallback(() => {
    if (!extractedData.length) return;
    const csvContent = exportToCSV(extractedData, translationMap);
    downloadFile(csvContent, generateOutputFileName(fileName, '.csv'));
    toast.success('فایل CSV صادر شد');
  }, [extractedData, translationMap, fileName]);

  const handleDownloadNormal = useCallback(async () => {
    if (!content) {
      toast.error('ابتدا فایلی را آپلود کنید');
      return;
    }

    try {
      setLoading(true);
      downloadFile(content, generateOutputFileName(fileName, '_Translated'));
      toast.success('فایل با متن درست دانلود شد');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error?.message || 'خطا در دانلود');
    } finally {
      setLoading(false);
    }
  }, [content, fileName, setLoading]);

  const handleDownloadReversed = useCallback(async () => {
    if (!content) {
      toast.error('ابتدا فایلی را آپلود کنید');
      return;
    }

    if (translationMap.size === 0) {
      toast.error('ابتدا ترجمه‌ها را ایمپورت کنید');
      return;
    }

    try {
      setLoading(true);
      
      let finalContent = content;
      
      // Use Worker for RTL mode if enabled and ready
      if (useWorkerMode && workerReady) {
        toast('🔄 پردازش Worker...', { icon: '⚡' });
        finalContent = await createDownloadPromise(content);
      } else {
        // Fallback to regular processing
        toast('🔄 در حال معکوس کردن متن...');
        finalContent = generateReversedContent(content, extractedData, translationMap);
      }

      downloadFile(finalContent, generateOutputFileName(fileName, '_Reversed'));
      toast.success('فایل با متن برعکس دانلود شد');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error?.message || 'خطا در دانلود');
    } finally {
      setLoading(false);
    }
  }, [content, translationMap, extractedData, fileName, useWorkerMode, workerReady, createDownloadPromise, setLoading]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  // Restore backup handler
  const handleRestoreBackup = useCallback(() => {
    const backup = restoreBackup();
    if (backup) {
      setContent(backup.content);
      toast.success(`بازیابی از پشتیبان (${new Date(backup.time).toLocaleString('fa-IR')})`);
    } else {
      toast.error('پشتیبانی یافت نشد');
    }
  }, [restoreBackup, setContent]);

  // Hotkeys
  useHotkeys([
    { key: 's', ctrl: true, handler: handleDownloadNormal },
    { key: 'o', ctrl: true, handler: () => fileInputRef.current?.click() },
    { key: 't', ctrl: true, handler: handleExportTerms },
    { key: 'i', ctrl: true, handler: () => importInputRef.current?.click() },
    { key: 'r', ctrl: true, handler: handleRestoreBackup },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 md:p-6" dir="rtl">
      <Toaster position="top-center" toastOptions={{ duration: CONFIG.TOAST_DURATION }} />
      
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-black text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Unity I2 Translator Pro
              </h1>
              <p className="text-blue-200">مترجم حرفه‌ای فایل‌های I2 Localization یونیتی</p>
            </div>
          </div>
          {fileName && (
            <div className="mt-4 bg-green-500/20 border border-green-500/50 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-semibold">{fileName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Statistics - moved to top */}
        {extractedData.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="text-blue-300 text-sm mb-1">کل متن‌ها</div>
              <div className="text-white text-3xl font-bold">{extractedData.length.toLocaleString('fa-IR')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="text-green-300 text-sm mb-1">ترجمه شده</div>
              <div className="text-white text-3xl font-bold">{translatedCount.toLocaleString('fa-IR')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="text-orange-300 text-sm mb-1">باقی‌مانده</div>
              <div className="text-white text-3xl font-bold">{(extractedData.length - translatedCount).toLocaleString('fa-IR')}</div>
            </div>
          </div>
        )}

        {/* Language selector & Worker mode toggle */}
        {!content && (
          <div className="space-y-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <label className="block text-white text-sm font-semibold mb-2">انتخاب زبان:</label>
              <select
                value={languageIndex}
                onChange={(e) => setLanguageIndex(+e.target.value)}
                className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
              >
                {[...Array(CONFIG.MAX_LANGUAGE_INDEX + 1)].map((_, i) => (
                  <option key={i} value={i} className="bg-gray-800">
                    Index [{i}] {i === 0 ? '(پیش‌فرض)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Worker Mode Toggle */}
            <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-xl p-4 border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-semibold text-sm">حالت Worker (پیشنهادی)</h3>
                    <button
                      onClick={() => setUseWorkerMode(!useWorkerMode)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        useWorkerMode
                          ? 'bg-yellow-500 text-black'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {useWorkerMode ? '✅ فعال' : 'غیرفعال'}
                    </button>
                  </div>
                  <p className="text-yellow-100 text-xs">
                    پردازش در پس‌زمینه برای فایل‌های بزرگ • {workerReady ? '✅ آماده' : '⏳ در حال آماده‌سازی...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {isLoading && progress > 0 && (
          <div className="mb-6 bg-white/10 rounded-xl p-4 border border-white/20">
            <div className="flex justify-between text-sm text-blue-200 mb-2">
              <span>در حال پردازش...</span>
              <span>{progress}٪</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Translation progress */}
        {extractedData.length > 0 && translatedCount > 0 && (
          <div className="mb-6 bg-white/10 rounded-xl p-4 border border-white/20">
            <div className="flex justify-between text-xs text-blue-200 mb-2">
              <span>پیشرفت ترجمه</span>
              <span>
                {translatedCount.toLocaleString('fa-IR')}/{extractedData.length.toLocaleString('fa-IR')}
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                style={{
                  width: `${extractedData.length ? (translatedCount / extractedData.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* File upload */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="mb-4"
        >
          <label className="block cursor-pointer">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg transition-all">
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-semibold">در حال پردازش...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="font-semibold">{content ? '✅ آپلود شد' : '📂 آپلود فایل'}</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
          </label>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {extractedData.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleExportTerms}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                TXT
              </button>
              <button
                onClick={handleExportJSON}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                JSON
              </button>
              <button
                onClick={handleExportCSV}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                CSV
              </button>
            </div>
          )}

          {content && (
            <>
              <label className="block cursor-pointer">
                <div className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 font-semibold transition-colors">
                  <Upload className="w-6 h-6" />
                  ایمپورت ترجمه
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files?.[0] || null)}
                  disabled={isLoading}
                />
              </label>

              <div className="flex gap-3">
                <button
                  onClick={handleRestoreBackup}
                  disabled={isLoading}
                  className="px-4 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-semibold transition-colors disabled:opacity-50"
                  title="بازیابی از پشتیبان (Ctrl+R)"
                >
                  🔄
                </button>
              </div>

              {/* دو دکمه دانلود جداگانه */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadNormal}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white px-6 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all shadow-lg"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                  متن فارسی معمولی
                </button>
                <button
                  onClick={handleDownloadReversed}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 text-white px-6 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all shadow-lg"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                  متن فارسی برعکس (Unity) {useWorkerMode && workerReady ? '⚡' : ''}
                </button>
              </div>

              <div className="mt-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-200 text-sm">
                    <strong className="block mb-1">نکته مهم:</strong>
                    برای Unity از نسخه "متن فارسی برعکس" استفاده کنید تا متن به درستی نمایش داده شود.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Search */}
        {extractedData.length > 0 && (
          <div className="mt-6 bg-white/10 rounded-xl p-4 border border-white/20">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="جستجو در متن‌ها..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/20 text-white placeholder-gray-300 pr-10 pl-4 py-3 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>
            {searchQuery && (
              <div className="mt-2 text-blue-200 text-sm">
                {filteredData.length.toLocaleString('fa-IR')} نتیجه
              </div>
            )}
          </div>
        )}

        {/* Live Translation Preview */}
        {extractedData.length > 0 && translationMap.size > 0 && (
          <div className="mt-6">
            <LiveTranslationPreview 
              data={extractedData} 
              translationMap={translationMap} 
            />
          </div>
        )}

        {/* Virtualized preview - Full list */}
        {filteredData.length > 0 && (
          <div className="mt-6">
            <div ref={containerRef}>
              <VirtualizedPreview
                data={filteredData.slice(0, 50)}
                translationMap={translationMap}
                containerRef={containerRef}
              />
            </div>
            {filteredData.length > 50 && (
              <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                <p className="text-white/60 text-sm">
                  ... و {(filteredData.length - 50).toLocaleString('fa-IR')} مورد دیگر
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!content && !isLoading && (
          <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
            <FileText className="w-24 h-24 text-white/20 mx-auto mb-6" />
            <h3 className="text-white text-2xl font-bold mb-3">آماده برای شروع</h3>
            <p className="text-white/60 text-lg mb-2">فایل Unity I2 خود را آپلود کنید</p>
            <p className="text-white/40 text-sm">پشتیبانی از میلیون‌ها متن در یک فایل</p>
          </div>
        )}


        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-2">
            Unity I2 Translator Pro - ساخته شده برای توسعه‌دهندگان حرفه‌ای
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-white/30">
            <span>✓ پشتیبانی از میلیون‌ها متن</span>
            <span>•</span>
            <span>✓ حفظ دقیق فرمت</span>
            <span>•</span>
            <span>✓ برعکس خودکار برای Unity</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
