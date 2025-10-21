import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, Wrench } from "lucide-react";

interface StructureIssue {
  type: 'error' | 'warning' | 'success';
  line: number;
  message: string;
}

interface AnalysisResult {
  isValid: boolean;
  issues: StructureIssue[];
  totalItems: number;
  validItems: number;
}

export const StructureAnalyzer = () => {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.asset')) {
      toast.error("Please select a .txt or .asset file");
      return;
    }

    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Error reading file"));
        reader.readAsText(file);
      });

      setInputText(content);
      toast.success(`File "${file.name}" loaded successfully`);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error("Error loading file");
    }
  };

  const analyzeStructure = async () => {
    if (!inputText.trim()) {
      toast.error("Please provide Unity I2Languages file content");
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    await new Promise(resolve => setTimeout(resolve, 300));

    const lines = inputText.split("\n");
    const issues: StructureIssue[] = [];
    let totalItems = 0;
    let validItems = 0;

    // Track expected structure states
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check for array items [number]
      const itemMatch = trimmedLine.match(/^\[(\d+)\]$/);
      if (itemMatch) {
        totalItems++;
        const itemNumber = parseInt(itemMatch[1]);
        
        // Check indentation (should have 3 spaces)
        const expectedIndent = "   ";
        if (!line.startsWith(expectedIndent + "[")) {
          issues.push({
            type: 'warning',
            line: i + 1,
            message: `Item [${itemNumber}] has incorrect indentation`
          });
        }

        // Look for required structure
        let hasTermData = false;
        let hasTerm = false;
        let hasNestedArray = false;
        let hasData = false;

        // Check next 20 lines for required elements
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          const checkLine = lines[j].trim();
          
          // Stop if we hit another item at same level
          if (checkLine.match(/^\[\d+\]$/)) break;

          if (checkLine.includes("0 TermData data")) hasTermData = true;
          if (checkLine.match(/1 string Term = /)) hasTerm = true;
          if (checkLine === "[0]") hasNestedArray = true;
          if (checkLine.match(/1 string data = /)) hasData = true;
        }

        // Report missing elements
        if (!hasTermData) {
          issues.push({
            type: 'error',
            line: i + 1,
            message: `Missing "0 TermData data" at item [${itemNumber}]`
          });
        }
        if (!hasTerm) {
          issues.push({
            type: 'error',
            line: i + 1,
            message: `Missing "1 string Term" at item [${itemNumber}]`
          });
        }
        if (!hasNestedArray) {
          issues.push({
            type: 'warning',
            line: i + 1,
            message: `Missing nested [0] array at item [${itemNumber}]`
          });
        }
        if (!hasData) {
          issues.push({
            type: 'warning',
            line: i + 1,
            message: `Missing "1 string data" at item [${itemNumber}]`
          });
        }

        if (hasTermData && hasTerm && hasNestedArray && hasData) {
          validItems++;
        }
      }

      // Check for broken quotes
      if (trimmedLine.includes('string') && trimmedLine.includes('=')) {
        const quoteCount = (trimmedLine.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          issues.push({
            type: 'error',
            line: i + 1,
            message: `Unmatched quotes in string declaration`
          });
        }
      }
    }

    clearInterval(progressInterval);
    setProgress(100);

    const result: AnalysisResult = {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      issues,
      totalItems,
      validItems
    };

    setAnalysisResult(result);
    setIsAnalyzing(false);

    if (result.isValid && issues.length === 0) {
      toast.success("✅ Structure is valid and clean!");
    } else if (result.isValid) {
      toast.warning(`⚠️ Structure is valid but has ${issues.length} warnings`);
    } else {
      toast.error(`❌ Found ${issues.filter(i => i.type === 'error').length} structural errors`);
    }
  };

  const autoFix = () => {
    if (!inputText.trim()) {
      toast.error("No content to fix");
      return;
    }

    const lines = inputText.split("\n");
    const fixed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Fix array item indentation
      const itemMatch = trimmedLine.match(/^\[(\d+)\]$/);
      if (itemMatch) {
        fixed.push(`   [${itemMatch[1]}]`);
        continue;
      }

      // Fix TermData indentation
      if (trimmedLine.match(/^0\s+TermData\s+data/)) {
        fixed.push("     0 TermData data");
        continue;
      }

      // Fix Term indentation
      const termMatch = trimmedLine.match(/^1\s+string\s+Term\s*=\s*"([^"]*)"/);
      if (termMatch) {
        fixed.push(`      1 string Term = "${termMatch[1]}"`);
        continue;
      }

      // Fix nested array indentation
      if (trimmedLine === "[0]" && i > 0 && !lines[i-1].trim().match(/^\[\d+\]$/)) {
        fixed.push("        [0]");
        continue;
      }

      // Fix data indentation
      const dataMatch = trimmedLine.match(/^1\s+string\s+data\s*=\s*"([^"]*)"/);
      if (dataMatch) {
        fixed.push(`         1 string data = "${dataMatch[1]}"`);
        continue;
      }

      // Keep line as is if no pattern matched
      if (trimmedLine) {
        fixed.push(line);
      }
    }

    const fixedContent = fixed.join("\n");
    setOutputText(fixedContent);
    toast.success("Auto-fix applied! Check the output section.");
  };

  const downloadOutput = () => {
    if (!outputText) {
      toast.error("No output to download");
      return;
    }

    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fixed-structure.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("File downloaded");
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-success" />;
      default: return null;
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
      <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Input File
        </h2>
        
        <div className="space-y-4">
          {isAnalyzing && (
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-primary">Analyzing structure...</span>
                <span className="text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste Unity I2Languages content here or upload a file..."
            className="min-h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="lg"
              disabled={isAnalyzing}
            >
              <Upload className="mr-2 h-5 w-5" />
              Upload File
            </Button>
            <Button
              onClick={analyzeStructure}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              size="lg"
              disabled={isAnalyzing}
            >
              Analyze Structure
            </Button>
          </div>

          {analysisResult && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Analysis Results</h3>
                <Badge variant={analysisResult.isValid ? "default" : "destructive"}>
                  {analysisResult.validItems}/{analysisResult.totalItems} Valid Items
                </Badge>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {analysisResult.issues.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-success/10 rounded-lg border border-success/20">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>No issues found - structure is perfect!</span>
                  </div>
                ) : (
                  analysisResult.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 text-sm p-2 rounded border ${
                        issue.type === 'error'
                          ? 'bg-destructive/10 border-destructive/20'
                          : 'bg-warning/10 border-warning/20'
                      }`}
                    >
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <span className="font-medium">Line {issue.line}:</span> {issue.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {analysisResult.issues.length > 0 && (
                <Button
                  onClick={autoFix}
                  variant="secondary"
                  className="w-full"
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Auto-Fix Issues
                </Button>
              )}
            </Card>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.asset"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </Card>

      <Card className="p-6 backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          Fixed Output
        </h2>

        <div className="space-y-4">
          <Textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="Fixed structure will appear here..."
            className="min-h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50"
            readOnly
          />

          <Button
            onClick={downloadOutput}
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!outputText}
          >
            <Download className="mr-2 h-5 w-5" />
            Download Fixed File
          </Button>
        </div>
      </Card>
    </div>
  );
};
