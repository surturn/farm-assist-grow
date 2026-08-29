import { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Loader2, AlertCircle, CheckCircle2, Share2, Bookmark, ChevronDown, ChevronUp, Leaf, Sprout, ShoppingBag, ExternalLink, FileText, Calendar, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";

// Import the utility functions
import { processImageUpload, resizeBase64 } from "@/lib/image_upload_util";
import { analyzeCropImage } from "@/lib/openai_vision_api";
import CameraCapture from "@/components/CameraCapture";
import { getAllDiseases, DiseaseData } from "@/lib/disease_fallback";
import { scansService } from "@/services/scans.service";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { fetchProductsForDisease, Product } from "@/lib/products";

interface AnalysisResult {
  diseaseName: string;
  confidence: number;
  cropType: string;
  severity: "Mild" | "Moderate" | "Severe";
  symptoms: string[];
  treatment: string;
  prevention: string[];
}

interface ScanHistory {
  id: string;
  image: string;
  cropType: string;
  diseaseName: string;
  date: string;
  confidence: number;
  createdAt?: string | { toDate: () => Date };
}

export default function Scan() {
  const { user } = useAuth();
  const { activeFarmId } = useFarm();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    symptoms: true,
    treatment: false,
    prevention: false,
  });

  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackDiseases, setFallbackDiseases] = useState<DiseaseData[]>([]);

  // Product Recommendations State
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  // Helper to load products
  const loadProducts = async (diseaseName: string) => {
    setIsProductsLoading(true);
    try {
      const products = await fetchProductsForDisease(diseaseName);
      setRecommendedProducts(products);
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setIsProductsLoading(false);
    }
  };

  // Setup history listener
  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        try {
          const data = await scansService.getScans(activeFarmId);
          setScanHistory(data);
        } catch (error) {
          console.error("Failed to fetch scan history", error);
        }
      };
      fetchHistory();
    }
  }, [user, activeFarmId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const uploadResult = await processImageUpload(file);
        if (uploadResult.success && uploadResult.data) {
          setSelectedImage(uploadResult.data);
          setResult(null); // Clear previous results
        } else {
          toast({
            title: "Upload Failed",
            description: uploadResult.error,
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error processing image:", error);
        toast({
          title: "Image Error",
          description: "Could not process image. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const handleCameraCapture = (imageData: string) => {
    setSelectedImage(imageData);
    setResult(null); // Clear previous results
    setShowCamera(false);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setShowFallback(false);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
    }, 300);

    try {
      console.log('Starting analysis...');
      const response = await analyzeCropImage(selectedImage, { apiKey: '' });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data) {
        setResult(response.data);
        loadProducts(response.data.diseaseName);

        // Auto-save the scan
        try {
          if (user) {
            // Create a thumbnail for the database to avoid 1MB limit
            const thumbnailImage = await resizeBase64(selectedImage, 500, 500, 0.7);

            const newScan = {
              image: thumbnailImage,
              cropType: response.data.cropType,
              diseaseName: response.data.diseaseName,
              date: new Date().toISOString().split("T")[0],
              confidence: response.data.confidence,
              farmId: activeFarmId
            };

            const data = await scansService.createScan(newScan);
            setScanHistory(prev => [data, ...prev]);

            toast({
              title: "Analysis Complete & Saved",
              description: `Detected: ${response.data.diseaseName}. Result has been saved.`,
            });
          } else {
            toast({
              title: "Analysis Complete",
              description: `Detected: ${response.data.diseaseName}`,
            });
          }
        } catch (saveError) {
          console.error("Auto-save failed", saveError);
          toast({
            title: "Analysis Complete",
            description: `Detected: ${response.data.diseaseName}. (Auto-save failed)`,
            variant: "destructive" // Or strict warning
          });
        }

      } else {
        const errorMsg = (response as any).error || 'Analysis failed';
        throw new Error(errorMsg);
      }

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Analysis error, trying fallback:', error);

      try {
        const localDiseases = await getAllDiseases();
        setFallbackDiseases(localDiseases);
        setShowFallback(true);
        toast({
          title: "AI Analysis Unsure",
          description: "Using offline database. Check symptoms below.",
        });
      } catch (e) {
        toast({ title: "Error", description: "Analysis failed.", variant: "destructive" });
      }
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  const selectFallbackDisease = (disease: DiseaseData) => {
    setResult({
      diseaseName: disease.name,
      confidence: 0,
      cropType: "Manual Selection",
      severity: disease.severity,
      symptoms: disease.symptoms,
      treatment: disease.treatment,
      prevention: disease.prevention
    });
    setShowFallback(false);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 80) return "bg-green-500";
    if (confidence > 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Mild":
        return "bg-green-100 text-green-800 border-green-300";
      case "Moderate":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Severe":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // handleSaveToHistory removed as it is now auto-saved


  const handleShare = () => {
    toast({
      title: "Share feature",
      description: "Sharing functionality coming soon.",
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4 space-y-6 pb-12">
        
        {/* Top Section - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Upload Card (Left - 2 Cols Wide) */}
          <Card className="lg:col-span-2 border-green-50 shadow-sm rounded-xl overflow-hidden relative">
            <CardHeader className="bg-[#fafffb] border-b border-green-50/50 pb-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-800">
                    <div className="bg-[#e8f5ed] p-2 rounded-lg">
                      <Camera className="h-6 w-6 text-[#198754]" />
                    </div>
                    Scan Crop Diseases
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 max-w-sm mt-2 leading-relaxed">
                    Upload a clear photo of your crop and get AI-powered disease detection and treatment recommendations.
                  </CardDescription>
                </div>
                {/* Abstract Illustration Placeholder */}
                <div className="hidden sm:flex absolute right-4 top-4 text-green-100 opacity-80">
                   <Sprout className="w-24 h-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {!selectedImage ? (
                <div
                  className="border-2 border-dashed border-[#d3e8dc] bg-[#fbfdfc] rounded-xl p-10 text-center hover:border-[#198754]/50 hover:bg-[#f2f9f5] transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-3 rounded-full border border-green-50 shadow-sm mb-2">
                      <Upload className="h-6 w-6 text-[#198754]" />
                    </div>
                    <p className="text-gray-700 font-medium">
                      Drag and drop your crop image here
                    </p>
                    <p className="text-gray-500 text-sm">
                      or <span className="text-[#198754] font-semibold">browse</span> your device
                    </p>
                    <p className="text-xs text-gray-400 mt-2 font-medium">
                      PNG, JPG, JPEG up to 10MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-green-100 shadow-sm">
                  <img
                    src={selectedImage}
                    alt="Selected crop"
                    className="w-full h-[280px] object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10"></div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-3 right-3 rounded-full shadow-lg"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-12 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium"
                  onClick={handleTakePhoto}
                >
                  <Camera className="h-4 w-4 mr-2 text-gray-500" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2 text-gray-500" />
                  Choose File
                </Button>
              </div>

              <div className="pt-2">
                <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                  <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-200 text-gray-600">
                    <SelectValue placeholder="Select farm (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="farm1">Farm 1 - North Field</SelectItem>
                    <SelectItem value="farm2">Farm 2 - South Valley</SelectItem>
                    <SelectItem value="farm3">Farm 3 - East Garden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full h-12 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white font-semibold text-base shadow-sm mt-2"
                disabled={!selectedImage || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing Crop...
                  </>
                ) : (
                  <>
                    <Leaf className="h-5 w-5 mr-2" />
                    Analyze Crop
                  </>
                )}
              </Button>

              {isAnalyzing && (
                <div className="space-y-2 pt-2 animate-in fade-in duration-300">
                  <Progress value={progress} className="h-2 bg-green-100" />
                  <p className="text-xs font-semibold text-center text-[#198754]">
                    AI is analyzing your crop... {progress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar Area (Right - 1 Col Wide) */}
          <div className="space-y-4">
            
            {/* How it works */}
            <Card className="border-gray-100 shadow-sm rounded-xl">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#198754]" /> How it works
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f2f9f5] flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-[#198754]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Upload a clear photo</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Take or upload a photo of the affected crop</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f2f9f5] flex items-center justify-center shrink-0">
                    <Sprout className="w-4 h-4 text-[#198754]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">AI analyzes the image</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Our AI detects diseases and issues</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f2f9f5] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#198754]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Get results & solutions</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Receive treatment recommendations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips for best results */}
            <Card className="border-gray-100 shadow-sm rounded-xl">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-yellow-500 text-lg">💡</span> Tips for best results
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600 font-medium">Use good natural lighting</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600 font-medium">Avoid blurry images</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600 font-medium">Focus on the leaves</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600 font-medium">Include one leaf at a time</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supported Crops */}
            <Card className="border-gray-100 shadow-sm rounded-xl">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-[#198754]" /> Supported Crops
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col items-center">
                <div className="flex justify-center gap-3 w-full mb-4">
                  {['🥔', '🌽', '🫘', '🍅', '🍒'].map((emoji, i) => (
                    <div key={i} className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center text-xl shadow-sm">
                      {emoji}
                    </div>
                  ))}
                </div>
                <a href="#" className="text-xs font-bold text-[#198754] hover:underline flex items-center gap-1">
                  View all supported crops <ArrowRight className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Results Section (Appears after analysis) */}
        {result && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <Card className="border-green-100 shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#f2f9f5] to-white border-b border-green-50">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-2xl font-bold text-gray-900">{result.diseaseName}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={`${getConfidenceColor(result.confidence)} text-white border-0 shadow-sm font-semibold`}>
                        {result.confidence}% Confidence
                      </Badge>
                      <Badge variant="outline" className="gap-1 border-gray-200 bg-white shadow-sm font-medium">
                        <Sprout className="h-3 w-3" />
                        {result.cropType}
                      </Badge>
                      <Badge variant="outline" className={`${getSeverityColor(result.severity)} shadow-sm font-medium border-0`}>
                        {result.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {/* Symptoms */}
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleSection("symptoms")}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="font-bold text-gray-800">Symptoms</span>
                    </div>
                    {expandedSections.symptoms ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.symptoms && (
                     <div className="p-4 pt-2 bg-white">
                      <ul className="space-y-2">
                        {result.symptoms.map((symptom, index) => (
                           <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1 font-bold">•</span>
                            <span className="text-sm text-gray-600 leading-relaxed">{symptom}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Treatment */}
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                   <button
                    className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleSection("treatment")}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-bold text-gray-800">Treatment</span>
                    </div>
                    {expandedSections.treatment ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.treatment && (
                     <div className="p-4 pt-2 bg-white">
                      <p className="text-sm text-gray-600 leading-relaxed">{result.treatment}</p>
                    </div>
                  )}
                </div>

                {/* Prevention */}
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleSection("prevention")}
                  >
                    <div className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-green-600" />
                      <span className="font-bold text-gray-800">Prevention</span>
                    </div>
                    {expandedSections.prevention ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.prevention && (
                     <div className="p-4 pt-2 bg-white">
                      <ul className="space-y-2">
                        {result.prevention.map((item, index) => (
                           <li key={index} className="flex items-start gap-2">
                            <span className="text-green-600 mt-1 font-bold">•</span>
                            <span className="text-sm text-gray-600 leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Sheet>
                    <SheetTrigger asChild>
                       <Button className="flex-1 bg-[#198754] hover:bg-[#146c43] text-white rounded-xl h-11 font-semibold shadow-sm" disabled={isProductsLoading}>
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        {isProductsLoading ? "Loading..." : "Product Recommendations"}
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="overflow-y-auto w-full sm:max-w-md">
                      <SheetHeader>
                        <SheetTitle>Recommended Products</SheetTitle>
                        <SheetDescription>
                          Treatments found for {result.diseaseName}
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6 space-y-4">
                        {recommendedProducts.length === 0 ? (
                           <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500">
                            <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="font-medium text-sm">No specific products found for this disease in our database.</p>
                            <p className="text-xs mt-2 opacity-75">Try consulting an agronomist for generic {result.treatment.split(' ')[0]}s.</p>
                          </div>
                        ) : (
                          recommendedProducts.map(product => (
                             <Card key={product.id} className="overflow-hidden border-gray-100 shadow-sm rounded-xl">
                              <div className="flex flex-col">
                                 <div className="bg-gray-50 border-b border-gray-100 h-28 flex items-center justify-center text-gray-300">
                                  <ShoppingBag className="h-10 w-10 opacity-30" />
                                </div>
                                <div className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                     <h4 className="font-bold text-gray-900">{product.productName}</h4>
                                     <Badge className="bg-[#e8f5ed] text-[#198754] border-0 hover:bg-[#d1ebd9]">{product.priceRange.min} - {product.priceRange.max} {product.priceRange.currency}</Badge>
                                  </div>
                                   <p className="text-xs font-semibold text-[#198754] mb-3">{product.activeIngredient} • <span className="text-gray-500 font-medium">{product.category}</span></p>
                                   <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">{product.notes}</p>
                                   <Button size="sm" className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm rounded-lg" asChild>
                                    <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Order", description: "Ordering functionality coming soon!" }) }}>
                                      View Details <ExternalLink className="ml-2 h-3 w-3 text-gray-400" />
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                   <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-gray-200 text-gray-600 shadow-sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fallback Selection UI */}
        {showFallback && (
           <Card className="border-orange-200 bg-orange-50 shadow-sm rounded-xl animate-in fade-in duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-orange-800 text-lg">
                <AlertCircle className="h-5 w-5" />
                Possible Matches
              </CardTitle>
               <CardDescription className="text-orange-700 font-medium text-sm">
                We couldn't reach the AI, but here are common diseases. Select one that matches your symptoms to see treatment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fallbackDiseases.map(disease => (
                <div key={disease.id}
                   className="p-4 bg-white rounded-xl border border-orange-100 cursor-pointer hover:border-orange-400 hover:shadow-md transition-all flex items-center justify-between group"
                  onClick={() => selectFallbackDisease(disease)}>
                  <div className="flex-1 pr-4">
                     <h4 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">{disease.name}</h4>
                     <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-1">
                      {disease.symptoms.join(", ")}
                    </p>
                  </div>
                   <Badge variant="outline" className={`${getSeverityColor(disease.severity)} shadow-sm border-0`}>{disease.severity}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* History Section (Bottom - Full Width) */}
        <Card className="border-gray-100 shadow-sm rounded-xl mt-8 overflow-hidden">
          <CardHeader className="bg-[#fafffb] border-b border-green-50/50 pb-5">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-[#e8f5ed] flex items-center justify-center">
                 <svg className="w-4 h-4 text-[#198754]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <div>
                <CardTitle className="text-[17px] font-bold text-gray-800">Recent Scans</CardTitle>
                 <CardDescription className="text-xs text-gray-500 mt-0.5">Your previous disease detection scans will appear here</CardDescription>
               </div>
             </div>
          </CardHeader>
          <CardContent className="p-6">
            {scanHistory.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 bg-[#f2f9f5] rounded-xl flex items-center justify-center mb-4 border border-green-50 shadow-sm">
                  <FileText className="w-6 h-6 text-[#198754]" />
                </div>
                <h4 className="text-base font-bold text-gray-800 mb-1">No scans yet</h4>
                <p className="text-sm text-gray-500 mb-6">Start by scanning your first crop to see results here.</p>
                <Button 
                  className="bg-white border-2 border-green-100 text-[#198754] hover:bg-[#f2f9f5] hover:border-[#198754] font-bold rounded-xl shadow-sm h-10 px-6 transition-all"
                  onClick={() => {
                    fileInputRef.current?.click();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Scan your first crop
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                     className="group border border-gray-100 rounded-xl bg-white hover:border-green-200 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-full"
                  >
                     <div className="h-36 w-full relative overflow-hidden bg-gray-50">
                      <img
                        src={scan.image}
                        alt={scan.diseaseName}
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                     </div>
                     <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                       <div>
                         <div className="flex items-start justify-between gap-2 mb-1.5">
                           <h4 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight group-hover:text-[#198754] transition-colors">{scan.diseaseName}</h4>
                           <Badge className={`${getConfidenceColor(scan.confidence)} text-white border-0 shadow-sm shrink-0 font-semibold px-1.5 py-0`}>
                            {scan.confidence}%
                          </Badge>
                        </div>
                         <p className="text-[11px] font-semibold text-[#198754] flex items-center gap-1 bg-[#e8f5ed] w-fit px-2 py-0.5 rounded-md">
                          <Sprout className="h-3 w-3" />
                          {scan.cropType}
                        </p>
                       </div>
                       <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1.5 pt-2 border-t border-gray-50">
                         <Calendar className="w-3 h-3" />
                        {scan.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border-0">
          <DialogHeader className="p-4 bg-gray-50 border-b border-gray-100">
             <DialogTitle className="font-bold text-gray-800 flex items-center gap-2">
               <Camera className="w-5 h-5 text-[#198754]" /> Take Photo
             </DialogTitle>
          </DialogHeader>
           <div className="bg-black">
            <CameraCapture
              onCapture={handleCameraCapture}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}