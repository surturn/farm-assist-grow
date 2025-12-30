import { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Loader2, AlertCircle, CheckCircle2, Share2, Bookmark, ChevronDown, ChevronUp, Leaf, Sprout, ShoppingBag, ExternalLink } from "lucide-react";
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
import { processImageUpload } from "@/lib/image_upload_util";
import { analyzeCropImage } from "@/lib/openai_vision_api";
import CameraCapture from "@/components/CameraCapture";
import { seedDiseases, getAllDiseases, DiseaseData } from "@/lib/disease_fallback";
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
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
  createdAt?: Timestamp;
}

export default function Scan() {
  const { user } = useAuth();
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

  // Seed diseases on load and setup history listener
  useEffect(() => {
    seedDiseases();

    if (user) {
      const q = query(
        collection(db, "scan_history"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as ScanHistory));
        setScanHistory(history);
      });

      return () => unsubscribe();
    }
  }, [user]);

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
        toast({
          title: "Analysis Complete",
          description: `Detected: ${response.data.diseaseName}`,
        });
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

  const handleSaveToHistory = async () => {
    if (!result || !selectedImage || !user) return;

    try {
      await addDoc(collection(db, "scan_history"), {
        userId: user.uid,
        image: selectedImage,
        cropType: result.cropType,
        diseaseName: result.diseaseName,
        date: new Date().toISOString().split("T")[0],
        confidence: result.confidence,
        createdAt: Timestamp.now()
      });
      toast({ title: "Saved", description: "Scan saved to history." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    }
  };

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
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Disease Detection
              </CardTitle>
              <CardDescription>
                Upload a photo of your crop to detect diseases and get treatment recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedImage ? (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-4">
                      <Camera className="h-12 w-12 text-muted-foreground" />
                      <Upload className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Upload crop photo or take picture</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={selectedImage}
                    alt="Selected crop"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleTakePhoto}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>

              <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select farm (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farm1">Farm 1 - North Field</SelectItem>
                  <SelectItem value="farm2">Farm 2 - South Valley</SelectItem>
                  <SelectItem value="farm3">Farm 3 - East Garden</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className="w-full"
                disabled={!selectedImage || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing crop...
                  </>
                ) : (
                  "Analyze Crop"
                )}
              </Button>

              {isAnalyzing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {progress}% complete
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-2xl">{result.diseaseName}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={getConfidenceColor(result.confidence)}>
                        {result.confidence}% Confidence
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Sprout className="h-3 w-3" />
                        {result.cropType}
                      </Badge>
                      <Badge variant="outline" className={getSeverityColor(result.severity)}>
                        {result.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Symptoms */}
                <div className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    onClick={() => toggleSection("symptoms")}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Symptoms</span>
                    </div>
                    {expandedSections.symptoms ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSections.symptoms && (
                    <div className="p-4 pt-0">
                      <ul className="space-y-2">
                        {result.symptoms.map((symptom, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span className="text-sm">{symptom}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Treatment */}
                <div className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    onClick={() => toggleSection("treatment")}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Treatment</span>
                    </div>
                    {expandedSections.treatment ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSections.treatment && (
                    <div className="p-4 pt-0">
                      <p className="text-sm">{result.treatment}</p>
                    </div>
                  )}
                </div>

                {/* Prevention */}
                <div className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    onClick={() => toggleSection("prevention")}
                  >
                    <div className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Prevention</span>
                    </div>
                    {expandedSections.prevention ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSections.prevention && (
                    <div className="p-4 pt-0">
                      <ul className="space-y-2">
                        {result.prevention.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button className="flex-1" variant="outline" disabled={isProductsLoading}>
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
                          <div className="text-center p-4 border border-dashed rounded-lg text-muted-foreground">
                            <p>No specific products found for this disease in our database.</p>
                            <p className="text-xs mt-1">Try consulting an agronomist for generic {result.treatment.split(' ')[0]}s.</p>
                          </div>
                        ) : (
                          recommendedProducts.map(product => (
                            <Card key={product.id} className="overflow-hidden">
                              <div className="flex flex-col">
                                <div className="bg-muted h-32 flex items-center justify-center text-muted-foreground">
                                  {/* Placeholder for product image since URLs might be empty or external */}
                                  <ShoppingBag className="h-10 w-10 opacity-20" />
                                </div>
                                <div className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold">{product.productName}</h4>
                                    <Badge variant="secondary">{product.priceRange.min} - {product.priceRange.max} {product.priceRange.currency}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">{product.activeIngredient} • {product.category}</p>
                                  <p className="text-sm mb-3 line-clamp-2">{product.notes}</p>
                                  <Button size="sm" className="w-full" asChild>
                                    <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Order", description: "Ordering functionality coming soon!" }) }}>
                                      View Details <ExternalLink className="ml-2 h-3 w-3" />
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
                  <Button variant="outline" size="icon" onClick={handleSaveToHistory}>
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fallback Selection UI */}
          {showFallback && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  Possible Matches
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  We couldn't reach the AI, but here are common diseases. Select one that matches your symptoms to see treatment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fallbackDiseases.map(disease => (
                  <div key={disease.id}
                    className="p-3 bg-white rounded border cursor-pointer hover:border-yellow-400 transition"
                    onClick={() => selectFallbackDisease(disease)}>
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-foreground">{disease.name}</h4>
                      <Badge variant="outline">{disease.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {disease.symptoms.slice(0, 2).join(", ")}...
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* History Section */}
        <Card>
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
            <CardDescription>Your previous disease detection scans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <img
                    src={scan.image}
                    alt={scan.diseaseName}
                    className="w-full h-32 object-cover rounded-md mb-3"
                  />
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm line-clamp-1">{scan.diseaseName}</h4>
                      <Badge className={getConfidenceColor(scan.confidence)} variant="secondary">
                        {scan.confidence}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sprout className="h-3 w-3" />
                      {scan.cropType}
                    </p>
                    <p className="text-xs text-muted-foreground">{scan.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
          </DialogHeader>
          <CameraCapture
            onCapture={handleCameraCapture}
            onCancel={() => setShowCamera(false)}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}