import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Filter, ArrowRight } from "lucide-react";

interface FilterOptions {
  includeTermData: boolean;
  includeTerm: boolean;
  includeTermType: boolean;
  includeLanguages: boolean;
  languageIndices: string; // comma-separated indices like "0,1,2"
}

export const AdvancedFilterTab = () => {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    includeTermData: true,
    includeTerm: true,
    includeTermType: false,
    includeLanguages: true,
    languageIndices: "", // empty means all
  });

  const parseIndices = (input: string): Set<number> | null => {
    if (!input.trim()) return null; // null means include all

    const normalized = input
      .replace(/[،؛;]/g, ',')
      .trim();

    const indices = new Set<number>();
    const parts = normalized.split(/[\s,]+/); // split by comma or whitespace

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === '') continue;
      // accept only non-negative integers; ignore ranges like 1-5
      if (!/^\d+$/.test(trimmed)) continue;
      const num = parseInt(trimmed, 10);
      if (num >= 0) indices.add(num);
    }

    return indices.size > 0 ? indices : null;
  };

  const processAdvancedFilter = () => {
    if (!inputText.trim()) {
      toast.error("لطفاً متن را وارد کنید");
      return;
    }

    const lines = inputText.split("\n");
    const formatted: string[] = [];
    
    const allowedLanguageIndices = parseIndices(filterOptions.languageIndices);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Find main item blocks - only match [number] at start without much indentation
      const itemMatch = line.match(/^\[(\d+)\]$/);
      if (!itemMatch) continue;
      
      // Skip if this looks like a language array item (check previous lines for "Array Array")
      let isLanguageItem = false;
      for (let k = Math.max(0, i - 5); k < i; k++) {
        if (lines[k].includes("Array Array") || lines[k].includes("string Languages")) {
          isLanguageItem = true;
          break;
        }
      }
      if (isLanguageItem) continue;
      
      const itemNumber = itemMatch[1];
      
      // Collect data for this item
      let termDataLine = "";
      let termLine = "";
      let termTypeLine = "";
      const languageLines: { index: number; content: string }[] = [];
      let inLanguagesArray = false;
      
      // Scan forward to collect all data for this item
      for (let j = i + 1; j < lines.length; j++) {
        const currentLine = lines[j].trim();
        
        // Stop at next main item header only when not inside Languages array
        if (currentLine.match(/^\[\d+\]$/) && j > i + 3) {
          if (!inLanguagesArray) {
            break;
          }
          const lookahead = (lines[j + 1] || "").trim();
          if (!lookahead.match(/string\s+data\s*=\s*"/)) {
            break;
          }
        }
        
        // Collect TermData
        if (currentLine.match(/TermData\s+data\s*$/)) {
          termDataLine = currentLine;
        }
        
        // Collect Term
        const termMatch = currentLine.match(/string\s+Term\s*=\s*"([^"]+)"/);
        if (termMatch) {
          termLine = currentLine;
        }
        
        // Collect TermType
        const typeMatch = currentLine.match(/int\s+TermType\s*=\s*(\d+)/);
        if (typeMatch) {
          termTypeLine = currentLine;
        }
        
        // Detect Languages array start
        if (currentLine.includes("string Languages") || currentLine.includes("Array Array")) {
          inLanguagesArray = true;
          continue;
        }
        
        // Collect language items
        if (inLanguagesArray) {
          const langIndexMatch = currentLine.match(/^\[(\d+)\]$/);
          if (langIndexMatch) {
            const langIndex = parseInt(langIndexMatch[1]);
            
            // Look for the data line immediately following
            if (j + 1 < lines.length) {
              const nextLine = lines[j + 1].trim();
              const dataMatch = nextLine.match(/string\s+data\s*=\s*"([^"]*)"/);
              if (dataMatch) {
                languageLines.push({
                  index: langIndex,
                  content: nextLine
                });
              }
            }
          }
        }
      }
      
      // Now build output based on filter options
      if (termDataLine || termLine) {
        formatted.push(`[${itemNumber}]`);
        
        if (filterOptions.includeTermData && termDataLine) {
          formatted.push(termDataLine);
        }
        
        if (filterOptions.includeTerm && termLine) {
          formatted.push(termLine);
        }
        
        if (filterOptions.includeTermType && termTypeLine) {
          formatted.push(termTypeLine);
        }
        
        if (filterOptions.includeLanguages && languageLines.length > 0) {
          // Filter language lines based on indices
          const filteredLanguages = allowedLanguageIndices 
            ? languageLines.filter(l => allowedLanguageIndices.has(l.index))
            : languageLines;
          
          if (filteredLanguages.length > 0) {
            for (const lang of filteredLanguages) {
              formatted.push(`[${lang.index}]`);
              formatted.push(lang.content);
            }
          }
        }
        
        formatted.push("");
      }
    }

    // Fallback parsing if nothing was captured (more tolerant)
    if (formatted.length === 0) {
      const fallback: string[] = [];
      let syntheticId = 0;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        const termMatch = l.match(/string\s+Term\s*=\s*"([^"]+)"/);
        if (!termMatch) continue;

        const itemId = syntheticId++;
        let termDataLine = "";
        let termTypeLine = "";
        const languageLines: { index: number; content: string }[] = [];

        // Look backward a bit for TermData
        for (let b = Math.max(0, i - 6); b < i; b++) {
          const bl = lines[b].trim();
          if (bl.match(/TermData\s+data\s*$/)) termDataLine = bl;
        }
        // Look forward for TermType and languages until next Term or end
        for (let j = i + 1; j < lines.length; j++) {
          const jl = lines[j].trim();
          if (jl.match(/string\s+Term\s*=\s*"/)) break;
          const typeMatch = jl.match(/int\s+TermType\s*=\s*(\d+)/);
          if (typeMatch) termTypeLine = jl;

          const idxMatch = jl.match(/^\[(\d+)\]$/);
          if (idxMatch) {
            const idx = parseInt(idxMatch[1]);
            if (j + 1 < lines.length) {
              const dl = lines[j + 1].trim();
              const dm = dl.match(/string\s+data\s*=\s*"([^"]*)"/);
              if (dm) languageLines.push({ index: idx, content: dl });
            }
          }
        }

        fallback.push(`[${itemId}]`);
        if (filterOptions.includeTermData && termDataLine) fallback.push(termDataLine);
        if (filterOptions.includeTerm) fallback.push(l);
        if (filterOptions.includeTermType && termTypeLine) fallback.push(termTypeLine);
        if (filterOptions.includeLanguages && languageLines.length > 0) {
          const filtered = allowedLanguageIndices
            ? languageLines.filter((x) => allowedLanguageIndices.has(x.index))
            : languageLines;
          for (const lang of filtered) {
            fallback.push(`[${lang.index}]`);
            fallback.push(lang.content);
          }
        }
        fallback.push("");
      }

      if (fallback.length > 0) {
        formatted.push(...fallback);
      }
    }

    const result = formatted.join("\n");
    setOutputText(result);
    
    if (result.trim()) {
      const itemCount = formatted.filter(l => l.match(/^\[\d+\]$/) && !l.includes('string')).length / 2;
      toast.success(`فیلتر اعمال شد - ${Math.floor(itemCount)} مورد پیدا شد`);
    } else {
      toast.error("هیچ داده‌ای با فیلتر انتخابی پیدا نشد");
    }
  };

  const copyToClipboard = async () => {
    if (!outputText) {
      toast.error("متنی برای کپی وجود ندارد");
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      toast.success("متن کپی شد");
    } catch (err) {
      toast.error("خطا در کپی کردن متن");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
      <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          متن اصلی
        </h2>
        
        <div className="space-y-4">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="متن Unity Asset را اینجا وارد کنید..."
            className="min-h-[200px] font-mono text-sm resize-none bg-background/50 border-border/50"
            dir="auto"
          />

          <Card className="p-4 bg-primary/5 border-primary/20">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              تنظیمات فیلتر پیشرفته
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="termdata"
                  checked={filterOptions.includeTermData}
                  onCheckedChange={(checked) => 
                    setFilterOptions(prev => ({ ...prev, includeTermData: checked as boolean }))
                  }
                />
                <Label htmlFor="termdata" className="text-sm cursor-pointer">
                  نمایش TermData
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="term"
                  checked={filterOptions.includeTerm}
                  onCheckedChange={(checked) => 
                    setFilterOptions(prev => ({ ...prev, includeTerm: checked as boolean }))
                  }
                />
                <Label htmlFor="term" className="text-sm cursor-pointer">
                  نمایش Term
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="termtype"
                  checked={filterOptions.includeTermType}
                  onCheckedChange={(checked) => 
                    setFilterOptions(prev => ({ ...prev, includeTermType: checked as boolean }))
                  }
                />
                <Label htmlFor="termtype" className="text-sm cursor-pointer">
                  نمایش TermType
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="languages"
                  checked={filterOptions.includeLanguages}
                  onCheckedChange={(checked) => 
                    setFilterOptions(prev => ({ ...prev, includeLanguages: checked as boolean }))
                  }
                />
                <Label htmlFor="languages" className="text-sm cursor-pointer">
                  نمایش زبان‌ها
                </Label>
              </div>

              {filterOptions.includeLanguages && (
                <div className="mr-6 space-y-2">
                  <Label htmlFor="indices" className="text-sm">
                    شاخص‌های زبان (خالی = همه)
                  </Label>
                  <Input
                    id="indices"
                    type="text"
                    placeholder="مثال: 0,1,2 یا خالی برای همه"
                    value={filterOptions.languageIndices}
                    onChange={(e) => 
                      setFilterOptions(prev => ({ ...prev, languageIndices: e.target.value }))
                    }
                    className="text-sm bg-background/50"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    شاخص‌های مورد نظر را با کاما جدا کنید (مثلاً: 1,3,5)
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Button
            onClick={processAdvancedFilter}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            size="lg"
          >
            <span>اعمال فیلتر</span>
            <ArrowRight className="mr-2 h-5 w-5" />
          </Button>
        </div>
      </Card>

      <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          خروجی فیلتر شده
        </h2>
        <div className="space-y-4">
          <Textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="نتیجه فیلتر شده اینجا نمایش داده می‌شود..."
            className="min-h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50"
            dir="auto"
          />
          <Button
            onClick={copyToClipboard}
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!outputText}
          >
            <Copy className="ml-2 h-5 w-5" />
            کپی کردن
          </Button>
        </div>
      </Card>
    </div>
  );
};
