import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw } from "lucide-react";

interface CameraCaptureProps {
    onCapture: (imageSrc: string) => void;
    onCancel: () => void;
}

const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "environment" // Use back camera on mobile by default
};

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [error, setError] = useState<string | null>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            onCapture(imageSrc);
        } else {
            setError("Failed to capture image. Please try again.");
        }
    }, [webcamRef, onCapture]);

    const handleUserMediaError = (error: string | DOMException) => {
        console.error("Camera error:", error);
        setError("Could not access camera. Please check permissions.");
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full h-full max-h-[80vh]">
            <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video flex items-center justify-center">
                {error ? (
                    <div className="text-destructive text-center p-4">
                        <p className="font-semibold">Camera Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                        onUserMediaError={handleUserMediaError}
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            <div className="flex gap-4 w-full justify-center">
                <Button variant="outline" onClick={onCancel}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={capture} disabled={!!error}>
                    <Camera className="mr-2 h-4 w-4" /> Capture
                </Button>
            </div>
        </div>
    );
}
