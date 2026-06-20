import React, { useState, useEffect, useRef, type ChangeEvent } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RefreshCcw, X, AlertCircle, CheckCircle2, XCircle, Info, ShieldAlert, Target, Sun } from "lucide-react";
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

  // Live validator checks state
  const [liveChecks, setLiveChecks] = useState({
    faceDetected: false,
    faceCentered: false,
    properLighting: false,
    overallPassed: false,
  });

  // Upload quality checks state
  const [uploadChecks, setUploadChecks] = useState({
    faceDetected: null as boolean | null,
    faceCentered: null as boolean | null,
    properLighting: null as boolean | null,
    matchesWebcam: null as boolean | null,
    overallPassed: false,
  });

  const [isVerifyingUpload, setIsVerifyingUpload] = useState(false);

  const videoCaptureRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceModelsLoadedRef = useRef(false);
  const uploadEmbeddingRef = useRef<number[] | null>(null);
  const liveAnalysisTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (studentPhotoPreview && studentPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
      if (liveAnalysisTimeoutRef.current) {
        clearTimeout(liveAnalysisTimeoutRef.current);
      }
    };
  }, [studentPhotoPreview]);

  // Handle camera video element play
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

  // Live webcam analyzer loop
  useEffect(() => {
    let active = true;
    if (!isCameraOpen) {
      setLiveChecks({
        faceDetected: false,
        faceCentered: false,
        properLighting: false,
        overallPassed: false,
      });
      return;
    }

    const runLiveAnalysis = async () => {
      if (!active) return;
      const videoElement = videoCaptureRef.current;
      if (!videoElement || videoElement.readyState < 2) {
        liveAnalysisTimeoutRef.current = window.setTimeout(runLiveAnalysis, 400);
        return;
      }

      try {
        await ensureFaceModelsLoaded();
        const detection = await faceapi
          .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          if (active) {
            setLiveChecks({
              faceDetected: false,
              faceCentered: false,
              properLighting: false,
              overallPassed: false,
            });
          }
        } else {
          // Face detected!
          // 1. Centering check
          const box = detection.detection.box;
          const videoWidth = videoElement.videoWidth || 640;
          const videoHeight = videoElement.videoHeight || 480;

          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const frameCenterX = videoWidth / 2;
          const frameCenterY = videoHeight / 2;

          const toleranceX = videoWidth * 0.18; // 18% horizontal tolerance from center
          const toleranceY = videoHeight * 0.18; // 18% vertical tolerance from center

          const isCentered =
            Math.abs(faceCenterX - frameCenterX) < toleranceX &&
            Math.abs(faceCenterY - frameCenterY) < toleranceY;

          // 2. Lighting check
          const canvas = document.createElement("canvas");
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext("2d");
          let avgBrightness = 120;
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, 100, 100);
            const imgData = ctx.getImageData(0, 0, 100, 100);
            let totalBrightness = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              const r = imgData.data[i];
              const g = imgData.data[i + 1];
              const b = imgData.data[i + 2];
              totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
            }
            avgBrightness = totalBrightness / 10000;
          }

          const isProperLight = avgBrightness >= 50 && avgBrightness <= 230;
          const overallPassed = isCentered && isProperLight;

          if (active) {
            setLiveChecks({
              faceDetected: true,
              faceCentered: isCentered,
              properLighting: isProperLight,
              overallPassed,
            });

            // Perform cross-matching if validating an uploaded image
            if (studentPhotoFile && uploadEmbeddingRef.current) {
              const liveEmbedding = Array.from(detection.descriptor);
              const distance = faceapi.euclideanDistance(uploadEmbeddingRef.current, liveEmbedding);
              const isMatch = distance < 0.40;

              setUploadChecks((prev) => ({
                ...prev,
                matchesWebcam: isMatch,
                overallPassed: prev.faceDetected === true && prev.faceCentered === true && prev.properLighting === true && isMatch,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Live analysis error", err);
      }

      if (active) {
        liveAnalysisTimeoutRef.current = window.setTimeout(runLiveAnalysis, 400);
      }
    };

    runLiveAnalysis();

    return () => {
      active = false;
      if (liveAnalysisTimeoutRef.current) {
        clearTimeout(liveAnalysisTimeoutRef.current);
      }
    };
  }, [isCameraOpen, studentPhotoFile]);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const resetStudentPhoto = () => {
    setStudentPhotoPreview("");
    setStudentPhotoFile(null);
    setCameraError("");
    setIsCameraOpen(false);
    setIsVerifyingUpload(false);
    uploadEmbeddingRef.current = null;
    stopCameraStream();
    setUploadChecks({
      faceDetected: null,
      faceCentered: null,
      properLighting: null,
      matchesWebcam: null,
      overallPassed: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRetake = () => {
    setStudentPhotoPreview("");
    setStudentPhotoFile(null);
    setCameraError("");
    setIsVerifyingUpload(false);
    uploadEmbeddingRef.current = null;
    setUploadChecks({
      faceDetected: null,
      faceCentered: null,
      properLighting: null,
      matchesWebcam: null,
      overallPassed: false,
    });
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
    if (!liveChecks.overallPassed) {
      setCameraError("Cannot capture: Ensure your face is centered and well-lit.");
      return;
    }

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

  const handleStudentPhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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

    try {
      setLoading(true);
      await ensureFaceModelsLoaded();
      const image = await createImageElementFromFile(file);

      const detection = await faceapi
        .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setUploadChecks({
          faceDetected: false,
          faceCentered: false,
          properLighting: false,
          matchesWebcam: null,
          overallPassed: false,
        });
        setCameraError("No face detected in the uploaded image. Please try a different photo.");
        return;
      }

      // Check centering
      const box = detection.detection.box;
      const isCentered =
        box.x + box.width / 2 > image.width * 0.25 &&
        box.x + box.width / 2 < image.width * 0.75 &&
        box.y + box.height / 2 > image.height * 0.25 &&
        box.y + box.height / 2 < image.height * 0.75;

      // Check lighting
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      let avgBrightness = 120;
      if (ctx) {
        ctx.drawImage(image, 0, 0, 100, 100);
        const imgData = ctx.getImageData(0, 0, 100, 100);
        let totalBrightness = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];
          totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        avgBrightness = totalBrightness / 10000;
      }
      const isProperLight = avgBrightness >= 50 && avgBrightness <= 230;

      const descriptor = Array.from(detection.descriptor);
      uploadEmbeddingRef.current = descriptor;

      setUploadChecks({
        faceDetected: true,
        faceCentered: isCentered,
        properLighting: isProperLight,
        matchesWebcam: null,
        overallPassed: false, // overallPassed is false until webcam match verifies it
      });

      if (!isCentered) {
        setCameraError("The uploaded face is not centered in the image. Please use a centered portrait.");
      } else if (!isProperLight) {
        setCameraError("The uploaded photo has poor lighting (too dark or too bright). Please use a well-lit photo.");
      } else {
        toast.info("Uploaded photo validation successful. Webcam verification is now required.");
      }
    } catch (err: any) {
      console.error("[FaceRegistrationModal] Failed to analyze upload", err);
      setCameraError(err?.message || "Failed to analyze the uploaded image.");
    } finally {
      setLoading(false);
    }
  };

  const startWebcamVerification = () => {
    setIsVerifyingUpload(true);
    void openCamera();
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

    // Double check validator checks
    const isUploaded = !!uploadEmbeddingRef.current;
    if (isUploaded && !uploadChecks.overallPassed) {
      setCameraError("Verification incomplete. Uploaded image must pass quality checks and match your live webcam feed.");
      return;
    }

    try {
      setLoading(true);
      setCameraError("");

      const profileImage = await convertFileToDataUrl(studentPhotoFile);
      const faceEmbedding = uploadEmbeddingRef.current || await generateFaceEmbedding(studentPhotoFile);

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

  const isSaveDisabled = loading || (studentPhotoFile ? (!!uploadEmbeddingRef.current && !uploadChecks.overallPassed) : true);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-4xl border border-border/60 bg-background shadow-2xl overflow-hidden flex flex-col md:grid md:grid-cols-5 h-[95vh] md:h-[680px] max-h-[95vh]">
        
        {/* Guidelines Left Panel (2 Columns) */}
        <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-border/60 bg-muted/10 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <Camera className="h-5 w-5" />
                Identity Setup Guidelines
              </CardTitle>
              <CardDescription className="mt-1.5 text-xs">
                To guarantee smooth access to your courses, please follow these instructions carefully.
              </CardDescription>
            </div>

            {/* Permanent Warning */}
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive">PERMANENT REGISTRATION</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  You <strong className="text-destructive font-medium">cannot change</strong> your face registration in the future. Ensure you register a high-quality, current photo.
                </p>
              </div>
            </div>

            {/* DOs & DONTs Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Instructions</h4>
              
              <div className="space-y-2.5">
                <div className="flex gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Look straight and center</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Keep your head aligned with the camera's circular frames.</p>
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Ensure proper lighting</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Avoid strong shadows or backlighting. Your face should be clearly lit.</p>
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">No beauty filters or old photos</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Filters or old images will cause verification to fail during the course.</p>
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">No face coverings</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Hats, sunglasses, or masks are not allowed. Clear glasses and religious turbans are allowed, but face boundary outlines must remain visible.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border/50 pt-4 hidden md:block">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>Face recognition technology is active to prevent proxy attendance.</span>
            </div>
          </div>
        </div>

        {/* Media Control Right Panel (3 Columns) */}
        <div className="md:col-span-3 p-6 flex flex-col h-full overflow-hidden">
          
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">
              {studentPhotoPreview ? "Preview Reference Image" : "Webcam Capture or File Upload"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              {!studentPhotoPreview ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" className="flex-1" onClick={openCamera}>
                      <Camera className="mr-2 h-4 w-4" />
                      Use Webcam (Recommended)
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
                    <div className="space-y-3 rounded-lg border border-border p-3 bg-card shadow-sm">
                      <div className="relative overflow-hidden rounded-lg bg-slate-950">
                        <video
                          ref={videoCaptureRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-64 w-full object-cover"
                          style={{ transform: "scaleX(-1)" }}
                        />
                        
                        {/* Live Tracking overlay checklist */}
                        <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md rounded-lg p-2.5 border border-white/10 space-y-1.5 text-xs text-white">
                          <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase pb-1 border-b border-white/10">
                            <span>Live Quality Checks</span>
                            <span className={liveChecks.overallPassed ? "text-green-400" : "text-amber-400 animate-pulse"}>
                              {liveChecks.overallPassed ? "Ready to Capture" : "Calibrating..."}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex items-center gap-1.5">
                              {liveChecks.faceDetected ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                              <span>Face detected</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {liveChecks.faceCentered ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                              <span>Centered</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {liveChecks.properLighting ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                              <span>Good light</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          className="flex-1"
                          onClick={capturePhoto}
                          disabled={!liveChecks.overallPassed}
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Capture Photo
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="flex-1"
                          onClick={stopCameraStream}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Reference image</span>
                      <img
                        src={studentPhotoPreview}
                        alt="Student preview"
                        className="h-44 w-full rounded-lg object-cover border border-border"
                      />
                    </div>

                    {/* Upload Validation status */}
                    {uploadEmbeddingRef.current ? (
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Upload Quality Verification</span>
                        
                        <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Target className="h-3.5 w-3.5 text-primary" /> Face Detected:
                            </span>
                            <span className={uploadChecks.faceDetected ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              {uploadChecks.faceDetected ? "Passed" : "Failed"}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Target className="h-3.5 w-3.5 text-primary" /> Centered Portrait:
                            </span>
                            <span className={uploadChecks.faceCentered ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              {uploadChecks.faceCentered ? "Passed" : "Failed"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Sun className="h-3.5 w-3.5 text-primary" /> Good Lighting:
                            </span>
                            <span className={uploadChecks.properLighting ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              {uploadChecks.properLighting ? "Passed" : "Failed"}
                            </span>
                          </div>

                          <div className="border-t border-border/80 pt-2 flex items-center justify-between font-semibold">
                            <span className="text-foreground">Webcam Match:</span>
                            <span className={
                              uploadChecks.matchesWebcam === true 
                                ? "text-green-600" 
                                : uploadChecks.matchesWebcam === false 
                                ? "text-red-600 animate-pulse" 
                                : "text-amber-500"
                            }>
                              {uploadChecks.matchesWebcam === true 
                                ? "Verified Match" 
                                : uploadChecks.matchesWebcam === false 
                                ? "No Match!" 
                                : "Awaiting Webcam..."
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center border border-dashed rounded-lg h-44 text-muted-foreground text-xs p-4 text-center bg-card">
                        Photo captured directly from webcam is fully validated.
                      </div>
                    )}
                  </div>

                  {/* Verification live match camera */}
                  {isVerifyingUpload && isCameraOpen && (
                    <div className="space-y-3 rounded-lg border border-border p-3 bg-card">
                      <div className="relative overflow-hidden rounded-lg bg-slate-950">
                        <video
                          ref={videoCaptureRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-44 w-full object-cover"
                          style={{ transform: "scaleX(-1)" }}
                        />
                        <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-md rounded px-2 py-1.5 text-[11px] text-white flex items-center justify-between border border-white/10">
                          <span className="flex items-center gap-1 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-red-500"></span> Live Webcam Feed
                          </span>
                          <span className={uploadChecks.matchesWebcam === true ? "text-green-400 font-semibold" : "text-amber-400 font-semibold"}>
                            {uploadChecks.matchesWebcam === true ? "Match Verified!" : "Look straight at the camera..."}
                          </span>
                        </div>
                      </div>
                      
                      {uploadChecks.matchesWebcam === false && (
                        <div className="text-[11px] text-destructive flex items-start gap-1 p-1">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>The face in front of the webcam does not match the uploaded image. Please ensure you uploaded your own current photo.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Webcam Match Prompt Button */}
                  {uploadEmbeddingRef.current && !uploadChecks.matchesWebcam && !isVerifyingUpload && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={startWebcamVerification}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Verify Photo via Webcam (Required)
                    </Button>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleRetake}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Retake / Replace
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
          </div>

          {/* Fixed Footer */}
          <div className="flex gap-3 pt-4 border-t border-border/50 mt-auto bg-background">
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
              disabled={isSaveDisabled}
            >
              {loading ? "Saving..." : "Save and Continue"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

