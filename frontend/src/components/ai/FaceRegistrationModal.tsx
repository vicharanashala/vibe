import React, { useState, useEffect, useRef, type ChangeEvent } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RefreshCcw, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const EMBEDDING_LENGTH = 128;

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [studentPhotoPreview, setStudentPhotoPreview] = useState<string>("");
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoCaptureRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceModelsLoadedRef = useRef(false);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (studentPhotoPreview && studentPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
    };
  }, [studentPhotoPreview]);

  useEffect(() => {
    if (!isCameraOpen || !mediaStreamRef.current || !videoCaptureRef.current) {
      return;
    }

    const videoElement = videoCaptureRef.current;
    videoElement.srcObject = mediaStreamRef.current;

    const handleLoadedMetadata = () => {
      void videoElement.play().catch((error) => {
        console.error("[FaceRegistrationModal] Unable to start camera preview", error);
        setCameraError("Camera opened, but preview could not start. Please try again.");
      });
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

    if (videoElement.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isCameraOpen]);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const resetStudentPhoto = () => {
    setStudentPhotoPreview("");
    setStudentPhotoFile(null);
    setCameraError("");
    setIsCameraOpen(false);
    stopCameraStream();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRetake = () => {
    setStudentPhotoPreview("");
    setStudentPhotoFile(null);
    setCameraError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    void openCamera();
  };

  const openCamera = async () => {
    try {
      setCameraError("");
      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      mediaStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      console.error("[FaceRegistrationModal] Unable to access camera", error);
      setCameraError("Camera access was blocked or unavailable. You can upload a photo instead.");
      setIsCameraOpen(false);
      stopCameraStream();
    }
  };

  const capturePhoto = () => {
    const videoElement = videoCaptureRef.current;
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setCameraError("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture the image. Please try again.");
      return;
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const previewDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setStudentPhotoPreview(previewDataUrl);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("Could not save the captured image. Please try again.");
        return;
      }

      const capturedFile = new File([blob], `student-photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      setStudentPhotoFile(capturedFile);
      setIsCameraOpen(false);
      stopCameraStream();
    }, "image/jpeg", 0.92);
  };

  const handleStudentPhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCameraError("Please choose a valid image file.");
      return;
    }

    setCameraError("");
    setStudentPhotoFile(file);
    setStudentPhotoPreview(URL.createObjectURL(file));
    setIsCameraOpen(false);
    stopCameraStream();
  };

  const convertFileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read the selected image."));
      reader.readAsDataURL(file);
    });

  const ensureFaceModelsLoaded = async () => {
    if (faceModelsLoadedRef.current) {
      return;
    }

    const modelPaths = [
      "/models",
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model",
    ];

    let lastError: unknown = null;
    for (const modelPath of modelPaths) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        ]);
        faceModelsLoadedRef.current = true;
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`Unable to load face models: ${String(lastError)}`);
  };

  const createImageElementFromFile = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read the selected face image."));
      };
      image.src = objectUrl;
    });

  const generateFaceEmbedding = async (file: File) => {
    await ensureFaceModelsLoaded();
    const image = await createImageElementFromFile(file);
    const detection = await faceapi
      .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection?.descriptor) {
      throw new Error("Could not detect a clear face in the selected photo. Please try another image.");
    }

    return Array.from(detection.descriptor);
  };

  const saveFaceReference = async () => {
    if (!studentPhotoFile) {
      setCameraError("Please capture or upload a clear face photo to continue.");
      return;
    }

    try {
      setLoading(true);
      setCameraError("");

      const profileImage = await convertFileToDataUrl(studentPhotoFile);
      const faceEmbedding = await generateFaceEmbedding(studentPhotoFile);

      if (!faceEmbedding || faceEmbedding.length !== EMBEDDING_LENGTH) {
        throw new Error("Face embedding generation failed. Try another image.");
      }

      const authToken = localStorage.getItem("firebase-auth-token");
      if (!authToken) {
        throw new Error("No authentication token found. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/users/me/face-reference`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ profileImage, faceEmbedding }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to save face photo (status ${response.status})`);
      }

      toast.success("Face registration completed successfully.");
      resetStudentPhoto();
      onSuccess();
    } catch (error: any) {
      console.error("[FaceRegistrationModal] Failed to save face reference", error);
      setCameraError(error?.message || "Unable to save your face photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg border border-border/60 bg-background shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Face Photo Required
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            This course has face recognition proctoring enabled. Please take a webcam photo or upload an image to confirm your identity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            {!studentPhotoPreview ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="flex-1" onClick={openCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Use Webcam
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleStudentPhotoUpload}
                />
                {isCameraOpen && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <video
                      ref={videoCaptureRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-56 w-full rounded-lg bg-slate-950 object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" className="flex-1" onClick={capturePhoto}>
                        <Camera className="mr-2 h-4 w-4" />
                        Capture Photo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => {
                          setIsCameraOpen(false);
                          stopCameraStream();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <img
                  src={studentPhotoPreview}
                  alt="Student preview"
                  className="h-56 w-full rounded-lg object-cover"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleRetake}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Retake
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={resetStudentPhoto}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            )}
            {cameraError && (
              <div className="flex items-start gap-2 text-destructive text-xs mt-2 rounded bg-destructive/10 p-2 border border-destructive/20">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>{cameraError}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={saveFaceReference}
            disabled={loading || !studentPhotoFile}
          >
            {loading ? "Saving..." : "Save and Continue"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
