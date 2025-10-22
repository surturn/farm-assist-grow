import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, AlertCircle, CheckCircle2, Share2, Bookmark, ChevronDown, ChevronUp, Leaf, Sprout } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
}

export default function Scan() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    symptoms: true,
    treatment: false,
    prevention: false,
  });
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([
    {
      id: "1",
      image: "/placeholder.svg",
      cropType: "Tomato",
      diseaseName: "Early Blight",
      date: "2024-01-15",
      confidence: 87,
    },
    {
      id: "2",
      image: "/placeholder.svg",
      cropType: "Maize",
      diseaseName: "Leaf Rust",
      date: "2024-01-14",
      confidence: 92,
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTakePhoto = () => {
    toast({
      title: "Camera feature",
      description: "Camera access coming soon. Please upload a photo for now.",
    });
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    // Simulate API call
    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      
      // Mock result
      const mockResult: AnalysisResult = {
        diseaseName: "Late Blight (Phytophthora infestans)",
        confidence: 87,
        cropType: "Tomato",
        severity: "Moderate",
        symptoms: [
          "Dark brown spots on leaves with white mold on undersides",
          "Rapid spreading during wet conditions",
          "Lesions on stems and fruits",
          "Leaves eventually turn brown and die",
        ],
        treatment: "Apply fungicides containing chlorothalonil or copper-based compounds. Remove and destroy infected plants. Improve air circulation and avoid overhead watering.",
        prevention: [
          "Plant resistant varieties when possible",
          "Space plants properly for air circulation",
          "Water at soil level, not overhead",
          "Remove plant debris after harvest",
          "Rotate crops yearly",
        ],
      };

      setResult(mockResult);
      setIsAnalyzing(false);
      setProgress(0);
    }, 2000);
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

  const handleSaveToHistory = () => {
    if (!result || !selectedImage) return;
    
    const newScan: ScanHistory = {
      id: Date.now().toString(),
      image: selectedImage,
      cropType: result.cropType,
      diseaseName: result.diseaseName,
      date: new Date().toISOString().split("T")[0],
      confidence: result.confidence,
    };
    
    setScanHistory([newScan, ...scanHistory]);
    toast({
      title: "Saved to history",
      description: "Scan has been saved to your history.",
    });
  };

  const handleShare = () => {
    toast({
      title: "Share feature",
      description: "Sharing functionality coming soon.",
    });
  };

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
                  <Button className="flex-1" variant="outline">
                    Product Recommendations
                  </Button>
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
    </DashboardLayout>
  );
}
