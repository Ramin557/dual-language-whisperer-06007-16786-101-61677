import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TranslationItem {
  term: string;
  english: string;
  persian: string;
  warnings: string[];
  category?: string;
}

interface TranslationOutputProps {
  translations: TranslationItem[];
  onDownload: (format: 'txt' | 'zip') => void;
}

export const TranslationOutput = ({ translations, onDownload }: TranslationOutputProps) => {
  const totalWarnings = translations.reduce((sum, t) => sum + t.warnings.length, 0);
  
  const categoryCounts = translations.reduce((acc, t) => {
    const cat = t.category || 'Misc';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          نتایج ترجمه
        </h2>
        <Badge variant={totalWarnings > 0 ? "destructive" : "default"}>
          {translations.length} ترجمه
          {totalWarnings > 0 && ` - ${totalWarnings} هشدار`}
        </Badge>
      </div>

      {Object.keys(categoryCounts).length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(categoryCounts).map(([category, count]) => (
            <Badge key={category} variant="outline">
              {category}: {count}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4 p-2">
        {translations.map((item, idx) => (
          <Card key={idx} className="p-4 bg-background/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  Term: {item.term}
                </span>
                {item.category && (
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground" dir="ltr">
                  EN: {item.english}
                </p>
                <p className="text-sm font-medium" dir="rtl">
                  FA: {item.persian}
                </p>
              </div>

              {item.warnings.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {item.warnings.map((warning, wIdx) => (
                      <p key={wIdx} className="text-xs text-warning">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => onDownload('txt')}
          variant="outline"
          size="lg"
          className="w-full"
        >
          <Download className="ml-2 h-5 w-5" />
          دانلود TXT
        </Button>
        <Button
          onClick={() => onDownload('zip')}
          variant="default"
          size="lg"
          className="w-full"
        >
          <Download className="ml-2 h-5 w-5" />
          دانلود ZIP (دسته‌بندی شده)
        </Button>
      </div>
    </Card>
  );
};
