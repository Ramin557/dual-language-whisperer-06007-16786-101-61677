import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TranslatorTab } from "@/components/TranslatorTab";
import { StructureAnalyzer } from "@/components/StructureAnalyzer";
import { AdvancedFilterTab } from "@/components/AdvancedFilterTab";
import { Languages, Shield, Layers, Filter } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("translator");
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("advanced");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Unity I2Languages Parser
          </h1>
          <p className="text-muted-foreground text-lg">
            ابزار استخراج و فرمت‌بندی داده‌های ترجمه از فایل‌های Unity Asset
          </p>
          
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant={viewMode === "simple" ? "default" : "outline"}
              onClick={() => setViewMode("simple")}
              className="flex items-center gap-2"
            >
              <Languages className="h-4 w-4" />
              حالت ساده
            </Button>
            <Button
              variant={viewMode === "advanced" ? "default" : "outline"}
              onClick={() => setViewMode("advanced")}
              className="flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              حالت پیشرفته
            </Button>
          </div>
        </header>

        {viewMode === "simple" ? (
          <TranslatorTab />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="translator" className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Translator
              </TabsTrigger>
              <TabsTrigger value="filter" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                فیلتر پیشرفته
              </TabsTrigger>
              <TabsTrigger value="analyzer" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Structure Analyzer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="translator">
              <TranslatorTab />
            </TabsContent>

            <TabsContent value="filter">
              <AdvancedFilterTab />
            </TabsContent>

            <TabsContent value="analyzer">
              <StructureAnalyzer />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Index;
