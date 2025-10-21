import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, ArrowRight, Upload, X, Trash2, Languages, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TranslationOutput } from "./TranslationOutput";
import { 
  extractStringsFromUnityFile, 
  generateTxtOutput, 
  generateCategorizedFiles, 
  createZipFile, 
  downloadFile 
} from "@/utils/translationHelpers";

interface FileInfo {
  name: string;
  size: number;
  content: string;
  hash?: string;
}

interface DuplicateGroup {
  hash: string;
  files: FileInfo[];
  selectedForDeletion: boolean[];
}

interface TranslationItem {
  term: string;
  english: string;
  persian: string;
  warnings: string[];
  category?: string;
}

export const TranslatorTab = () => {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<TranslationItem[]>([]);
  const [enableAiTranslation, setEnableAiTranslation] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' بایت';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' کیلوبایت';
    return (bytes / (1024 * 1024)).toFixed(2) + ' مگابایت';
  };

  const calculateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const textFiles = Array.from(files).filter(file => file.name.endsWith('.txt'));
    
    if (textFiles.length === 0) {
      toast.error("لطفاً فقط فایل‌های TEXT انتخاب کنید");
      return;
    }

    if (textFiles.length !== files.length) {
      toast.warning(`${files.length - textFiles.length} فایل غیر TEXT نادیده گرفته شد`);
    }

    setIsUploading(true);
    setUploadProgress(0);
    const newFiles: FileInfo[] = [];
    let combinedContent = inputText;

    for (let i = 0; i < textFiles.length; i++) {
      const file = textFiles[i];
      
      try {
        setUploadProgress((i / textFiles.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
          reader.readAsText(file);
        });

        const hash = await calculateHash(content);
        
        newFiles.push({
          name: file.name,
          size: file.size,
          content: content,
          hash: hash
        });

        combinedContent += (combinedContent ? "\n\n" : "") + content;
        setUploadProgress(((i + 1) / textFiles.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        toast.error(`خطا در خواندن ${file.name}`);
      }
    }

    setUploadedFiles([...uploadedFiles, ...newFiles]);
    setInputText(combinedContent);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    setUploadProgress(0);
    setIsUploading(false);
    toast.success(`${textFiles.length} فایل با موفقیت بارگذاری شد`);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    const newContent = newFiles.map(f => f.content).join("\n\n");
    setInputText(newContent);
    setShowDuplicates(false);
    setDuplicateGroups([]);
    toast.success("فایل حذف شد");
  };

  const findDuplicates = () => {
    if (uploadedFiles.length < 2) {
      toast.error("حداقل ۲ فایل برای یافتن تکراری‌ها نیاز است");
      return;
    }

    const hashMap = new Map<string, FileInfo[]>();
    
    uploadedFiles.forEach(file => {
      if (file.hash) {
        if (!hashMap.has(file.hash)) {
          hashMap.set(file.hash, []);
        }
        hashMap.get(file.hash)!.push(file);
      }
    });

    const duplicates: DuplicateGroup[] = [];
    hashMap.forEach((files, hash) => {
      if (files.length > 1) {
        duplicates.push({
          hash,
          files,
          selectedForDeletion: new Array(files.length).fill(false)
        });
      }
    });

    if (duplicates.length === 0) {
      toast.info("فایل تکراری پیدا نشد");
      setShowDuplicates(false);
    } else {
      setDuplicateGroups(duplicates);
      setShowDuplicates(true);
      toast.success(`${duplicates.length} گروه فایل تکراری پیدا شد`);
    }
  };

  const toggleDuplicateSelection = (groupIndex: number, fileIndex: number) => {
    const newGroups = [...duplicateGroups];
    newGroups[groupIndex].selectedForDeletion[fileIndex] = !newGroups[groupIndex].selectedForDeletion[fileIndex];
    setDuplicateGroups(newGroups);
  };

  const deleteSelectedDuplicates = () => {
    const filesToDelete = new Set<string>();
    
    duplicateGroups.forEach(group => {
      group.files.forEach((file, index) => {
        if (group.selectedForDeletion[index]) {
          filesToDelete.add(file.name);
        }
      });
    });

    if (filesToDelete.size === 0) {
      toast.error("هیچ فایلی برای حذف انتخاب نشده است");
      return;
    }

    const newFiles = uploadedFiles.filter(file => !filesToDelete.has(file.name));
    setUploadedFiles(newFiles);
    
    const newContent = newFiles.map(f => f.content).join("\n\n");
    setInputText(newContent);
    
    setShowDuplicates(false);
    setDuplicateGroups([]);
    toast.success(`${filesToDelete.size} فایل تکراری حذف شد`);
  };

  const processText = async () => {
    if (!inputText.trim()) {
      toast.error("لطفاً خروجی Unity Asset را وارد کنید");
      return;
    }

    setIsTranslating(true);
    setUploadProgress(0);

    try {
      // Extract strings from Unity file
      const extracted = extractStringsFromUnityFile(inputText);
      
      if (extracted.length === 0) {
        toast.error("هیچ داده‌ای با فرمت مورد نظر پیدا نشد");
        setIsTranslating(false);
        return;
      }

      setUploadProgress(20);

      if (enableAiTranslation) {
        // Call AI translation edge function
        toast.info(`در حال ترجمه ${extracted.length} رشته به فارسی...`);
        
        const { data, error } = await supabase.functions.invoke('translate-to-persian', {
          body: { 
            texts: extracted.map(e => e.data),
            preservePlaceholders: true 
          }
        });

        if (error) {
          console.error("Translation error:", error);
          throw new Error(error.message || "خطا در ترجمه");
        }

        setUploadProgress(80);

        if (!data?.translations) {
          throw new Error("خطا در دریافت ترجمه‌ها");
        }

        // Combine extraction with translations
        const translationResults: TranslationItem[] = extracted.map((item, idx) => ({
          term: item.term,
          english: item.data,
          persian: data.translations[idx]?.persian || item.data,
          warnings: data.translations[idx]?.warnings || [],
          category: item.category,
        }));

        setTranslations(translationResults);
        
        // Generate formatted output
        const output = generateTxtOutput(translationResults);
        setOutputText(output);
        
        setUploadProgress(100);
        toast.success(`✨ ترجمه با موفقیت انجام شد - ${translationResults.length} مورد`);
      } else {
        // Just extract and format without translation
        const formatted: string[] = [];
        
        extracted.forEach((item, idx) => {
          formatted.push(`[${idx}]`);
          formatted.push(`0 TermData data`);
          formatted.push(`  1 string Term = "${item.term}"`);
          formatted.push(`[0]`);
          formatted.push(`  1 string data = "${item.data}"`);
          formatted.push("");
        });

        const result = formatted.join("\n");
        setOutputText(result);
        toast.success(`متن استخراج شد - ${extracted.length} مورد`);
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(error instanceof Error ? error.message : "خطا در پردازش");
    } finally {
      setIsTranslating(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (format: 'txt' | 'zip') => {
    if (translations.length === 0) {
      toast.error("ابتدا متن را ترجمه کنید");
      return;
    }

    try {
      if (format === 'txt') {
        const content = generateTxtOutput(translations);
        const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
        downloadFile(blob, 'translations.txt');
        toast.success("فایل دانلود شد");
      } else {
        // Generate categorized files
        const files = generateCategorizedFiles(translations);
        const zipBlob = await createZipFile(files);
        downloadFile(zipBlob, 'translations-categorized.txt');
        toast.success("فایل‌های دسته‌بندی شده دانلود شد");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("خطا در دانلود فایل");
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {translations.length > 0 ? (
        <TranslationOutput translations={translations} onDownload={handleDownload} />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              متن اصلی
            </h2>
            <div className="space-y-4">
              {(isUploading || isTranslating) && (
              <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-primary">
                    {isTranslating ? "در حال ترجمه..." : "در حال آپلود فایل‌ها..."}
                  </span>
                  <span className="text-primary">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
            
            {/* AI Translation Toggle */}
            <Card className="p-4 bg-accent/5 border-accent/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <div>
                    <Label htmlFor="ai-toggle" className="text-sm font-semibold cursor-pointer">
                      ترجمه هوشمند به فارسی
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      استفاده از هوش مصنوعی برای ترجمه طبیعی و بازی‌محور
                    </p>
                  </div>
                </div>
                <Checkbox
                  id="ai-toggle"
                  checked={enableAiTranslation}
                  onCheckedChange={(checked) => setEnableAiTranslation(checked as boolean)}
                />
              </div>
            </Card>

            {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">فایل‌های آپلود شده:</h3>
                {uploadedFiles.length >= 2 && (
                  <Button
                    onClick={findDuplicates}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    یافتن تکراری‌ها
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between bg-background/50 border border-border/50 rounded-md p-2 text-sm"
                  >
                    <div className="flex-1 truncate">
                      <span className="font-medium">{file.name}</span>
                      <span className="text-muted-foreground mr-2">({formatFileSize(file.size)})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                مجموع: {uploadedFiles.length} فایل ({formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.size, 0))})
              </div>
            </div>
          )}

          {showDuplicates && duplicateGroups.length > 0 && (
            <Card className="p-4 bg-warning/5 border-warning/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-warning">فایل‌های تکراری یافت شده</h3>
                  <Button
                    onClick={deleteSelectedDuplicates}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف انتخاب شده‌ها
                  </Button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {duplicateGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-2 p-3 bg-background/50 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        گروه {groupIndex + 1} - {group.files.length} فایل یکسان
                      </p>
                      <div className="space-y-2">
                        {group.files.map((file, fileIndex) => (
                          <div key={fileIndex} className="flex items-center gap-2 p-2 bg-background rounded">
                            <Checkbox
                              checked={group.selectedForDeletion[fileIndex]}
                              onCheckedChange={() => toggleDuplicateSelection(groupIndex, fileIndex)}
                            />
                            <div className="flex-1 truncate text-sm">
                              <span className="font-medium">{file.name}</span>
                              <span className="text-muted-foreground mr-2">({formatFileSize(file.size)})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="خروجی Unity Asset Dump (فایل I2Languages) را اینجا وارد کنید یا فایل TEXT آپلود کنید..."
              className="min-h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              dir="auto"
            />
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="lg"
                className="w-full"
                disabled={isUploading || isTranslating}
              >
                <Upload className="ml-2 h-5 w-5" />
                <span>{isUploading ? "در حال آپلود..." : "آپلود فایل TEXT"}</span>
              </Button>
              <Button
                onClick={processText}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                size="lg"
                disabled={isTranslating}
              >
                {enableAiTranslation && <Languages className="ml-2 h-5 w-5" />}
                <span>{isTranslating ? "در حال ترجمه..." : enableAiTranslation ? "ترجمه هوشمند" : "استخراج متن"}</span>
                {!isTranslating && <ArrowRight className="mr-2 h-5 w-5" />}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </Card>

        <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            خروجی فرمت شده
          </h2>
          <div className="space-y-4">
            <Textarea
              value={outputText}
              onChange={(e) => setOutputText(e.target.value)}
              placeholder="نتیجه فرمت شده اینجا نمایش داده می‌شود..."
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
      )}

    </div>
  );
};
