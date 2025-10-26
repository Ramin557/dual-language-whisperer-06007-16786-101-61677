import { useMemo } from 'react';
import { Eye, CheckCircle2, XCircle } from 'lucide-react';

interface ExtractedItem {
  term: string;
  originalText: string;
  dataLineIndex?: number;
  linePrefix?: string;
}

interface LiveTranslationPreviewProps {
  data: ExtractedItem[];
  translationMap: Map<string, string>;
}

export const LiveTranslationPreview = ({ data, translationMap }: LiveTranslationPreviewProps) => {
  // Get translated and untranslated items
  const { translated, untranslated } = useMemo(() => {
    const trans: ExtractedItem[] = [];
    const untrans: ExtractedItem[] = [];
    
    data.forEach(item => {
      const translation = translationMap.get(item.term);
      if (translation && translation.trim()) {
        trans.push(item);
      } else {
        untrans.push(item);
      }
    });
    
    return { translated: trans, untranslated: untrans };
  }, [data, translationMap]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-green-300 text-sm font-semibold">ترجمه شده</span>
          </div>
          <div className="text-white text-3xl font-bold">{translated.length.toLocaleString('fa-IR')}</div>
        </div>
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-orange-400" />
            <span className="text-orange-300 text-sm font-semibold">ترجمه نشده</span>
          </div>
          <div className="text-white text-3xl font-bold">{untranslated.length.toLocaleString('fa-IR')}</div>
        </div>
      </div>

      {/* Live Preview of Translations */}
      {translated.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-blue-400" />
            <h3 className="text-white font-bold text-xl">پیش‌نمایش زنده ترجمه‌ها</h3>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {translated.slice(0, 20).map((item, idx) => {
              const translation = translationMap.get(item.term) || '';
              return (
                <div key={idx} className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl p-4 border border-green-500/30 hover:border-green-500/50 transition-all">
                  <div className="text-blue-300 font-mono text-xs mb-2 opacity-75">
                    {item.term}
                  </div>
                  
                  {/* Original Text */}
                  <div className="mb-3">
                    <div className="text-white/60 text-xs mb-1">متن اصلی:</div>
                    <div className="bg-white/5 rounded-lg p-2 text-white text-sm">
                      {item.originalText}
                    </div>
                  </div>
                  
                  {/* Translation */}
                  <div>
                    <div className="text-green-300 text-xs mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ترجمه:
                    </div>
                    <div className="bg-green-500/20 rounded-lg p-2 text-green-100 text-sm font-semibold border border-green-500/30">
                      {translation}
                    </div>
                  </div>
                </div>
              );
            })}
            {translated.length > 20 && (
              <div className="text-white/60 text-center py-3 text-sm">
                و {(translated.length - 20).toLocaleString('fa-IR')} ترجمه دیگر...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Untranslated Items */}
      {untranslated.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-6 h-6 text-orange-400" />
            <h3 className="text-white font-bold text-xl">موارد ترجمه نشده</h3>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {untranslated.slice(0, 20).map((item, idx) => (
              <div key={idx} className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                <div className="text-orange-300 font-mono text-xs mb-1">
                  {item.term}
                </div>
                <div className="text-white/80 text-sm">
                  {item.originalText}
                </div>
              </div>
            ))}
            {untranslated.length > 20 && (
              <div className="text-white/60 text-center py-2 text-sm">
                و {(untranslated.length - 20).toLocaleString('fa-IR')} مورد دیگر...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
