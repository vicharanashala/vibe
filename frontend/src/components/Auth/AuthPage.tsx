import { loginWithGoogle, loginWithEmail, auth } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, AlertCircle, Eye, EyeOff, Camera, Upload, RefreshCcw, X, CheckCircle2, XCircle, Info, ShieldAlert, Target, Sun } from "lucide-react";
import { ShineBorder } from "@/components/magicui/shine-border";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { cn } from "@/utils/utils";
import { useSignup } from "@/hooks/hooks.ts";
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from "sonner";
import { LeftHeroSection } from "@/components/Auth/LeftHeroSection";

type AuthPageProps = {
  role?: "teacher" | "student";
}
export default function AuthPage({ role }: AuthPageProps) {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState<"teacher" | "student">(role || "student");

  // New state variables
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
    auth?: string;
    recaptcha?: string;
  }>({});

  const isRecaptchaEnabled: boolean = import.meta.env.VITE_IS_RECAPTCHA_ENABLED === "true";

  // reCAPTCHA state
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [studentPhotoPreview, setStudentPhotoPreview] = useState<string>("");
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [googleSignupPending, setGoogleSignupPending] = useState<{
    idToken: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  const completeFaceMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("completeFace") === "1";
  const videoCaptureRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceModelsLoadedRef = useRef(false);

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
  const uploadEmbeddingRef = useRef<number[] | null>(null);
  const liveAnalysisTimeoutRef = useRef<number | null>(null);

  // Removed the unused clearUser variable
  const setUser = useAuthStore((state) => state.setUser);

  // Password validation
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const calculatePasswordStrength = (password: string) => {
    if (!password) return { value: 0, label: "Weak", color: "bg-red-500" };

    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 25;

    if (strength <= 25) return { value: strength, label: "Weak", color: "bg-red-500" };
    if (strength <= 50) return { value: strength, label: "Fair", color: "bg-yellow-500" };
    if (strength <= 75) return { value: strength, label: "Good", color: "bg-blue-500" };
    return { value: strength, label: "Strong", color: "bg-green-500" };
  };

  const passwordStrength = calculatePasswordStrength(password);

  const toggleSignUpMode = () => {
    setIsSignUp(!isSignUp);
    setFormErrors({});
  };

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

  // Live webcam analyzer loop for AuthPage
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

          const toleranceX = videoWidth * 0.18;
          const toleranceY = videoHeight * 0.18;

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
        console.error("Live analysis error in AuthPage", err);
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
      console.error("Unable to access camera", error);
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
        overallPassed: false,
      });

      if (!isCentered) {
        setCameraError("The uploaded face is not centered in the image. Please use a centered portrait.");
      } else if (!isProperLight) {
        setCameraError("The uploaded photo has poor lighting (too dark or too bright). Please use a well-lit photo.");
      } else {
        toast.info("Uploaded photo validation successful. Webcam verification is now required.");
      }
    } catch (err: any) {
      console.error("[AuthPage] Failed to analyze upload", err);
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

  // Load the face-api models on demand so signup can derive a stable embedding
  // from the registration photo without forcing the app to preload them globally.
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

  // We store the 128-d face descriptor at signup so verification can compare
  // live webcam frames directly against the registered embedding later.
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

  const validateForm = () => {
    const errors: typeof formErrors = {};

    // if (!fullName) errors.fullName = "Name is required";
    // else if (!/^[A-Za-z ]+$/.test(fullName)) errors.fullName = "Name can only contain letters and spaces";

    if (isSignUp) {
      if (!fullName) errors.fullName = "Name is required";
      else if (!/^[A-Za-z ]+$/.test(fullName)) {
        errors.fullName = "Name can only contain letters and spaces";
      }
    }

    if (!email) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Invalid email format";

    if (!password) errors.password = "Password is required";
    else if (isSignUp && password.length < 8) errors.password = "Password must be at least 8 characters";

    if (isSignUp && !fullName) errors.fullName = "Full name is required";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setFormErrors({});
      const result = await loginWithGoogle();
      const chosenRole = activeRole;

      if (result._tokenResponse.isNewUser) {
        if (chosenRole === "student") {
          // Students need a face photo for proctoring. Defer the backend POST
          // until they've captured or uploaded one.
          resetStudentPhoto();
          setGoogleSignupPending({
            idToken: result._tokenResponse.idToken,
            email: result.user.email || "",
            firstName: result._tokenResponse.firstName || "",
            lastName: result._tokenResponse.lastName || "",
          });
          return;
        }

        // Non-student roles (teacher) skip the photo step.
        const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/signup/google/`;
        const response = await fetch(backendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${result._tokenResponse.idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: result.user.email,
            firstName: result._tokenResponse.firstName,
            lastName: result._tokenResponse.lastName,
            role: chosenRole,
          }),
        });
        if (!response.ok) {
          throw new Error(`Signup failed with status ${response.status}`);
        }
      }

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: chosenRole,
        avatar: result.user.photoURL || "",
      });

      // Check for redirect param
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");

      if (redirectUrl) {
        navigate({ to: redirectUrl });
      } else {
        navigate({ to: `/${chosenRole}` });
      }
    } catch (error) {
      console.error("Google Login Failed", error);
      setFormErrors({
        ...formErrors,
        auth: (() => {
          const code = (error as any)?.code;
          if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled. Please try again.";
          if (code === "auth/network-request-failed") return "Network error. Please check your connection and try again.";
          if (code === "auth/user-disabled") return "Your account has been disabled. Please contact support.";
          return "Failed to sign in with Google. Please try again.";
        })()
      });
    } finally {
      setLoading(false);
    }
  };

  const finishGoogleSignup = async (
    profileImage?: string,
    faceEmbedding?: number[],
  ) => {
    if (!googleSignupPending) return;

    const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/signup/google/`;
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleSignupPending.idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: googleSignupPending.email,
        firstName: googleSignupPending.firstName,
        lastName: googleSignupPending.lastName,
        role: "student",
        ...(profileImage ? { profileImage } : {}),
        ...(faceEmbedding ? { faceEmbedding } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Signup failed with status ${response.status}`);
    }

    const fbUser = auth.currentUser;
    setUser({
      uid: fbUser?.uid || "",
      email: fbUser?.email || googleSignupPending.email,
      name:
        fbUser?.displayName ||
        `${googleSignupPending.firstName} ${googleSignupPending.lastName}`.trim(),
      role: "student",
      avatar: fbUser?.photoURL || "",
    });

    setGoogleSignupPending(null);
    resetStudentPhoto();

    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get("redirect");
    navigate({ to: redirectUrl || "/student" });
  };

  const skipGoogleSignupPhoto = async () => {
    try {
      setLoading(true);
      setCameraError("");
      await finishGoogleSignup();
    } catch (error: any) {
      console.error("Google signup (skip photo) failed", error);
      setCameraError(error?.message || "Unable to complete signup. Please try again.");
    } finally {
      setLoading(false);
    }
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

      const authToken = localStorage.getItem("firebase-auth-token");
      if (!authToken) {
        throw new Error("Please sign in again to save your face photo.");
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

      resetStudentPhoto();

      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");
      navigate({ to: redirectUrl || `/${user?.role || "student"}` });
    } catch (error: any) {
      console.error("Failed to save face reference", error);
      setCameraError(error?.message || "Unable to save your face photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleSignup = async () => {
    if (!googleSignupPending) return;
    if (!studentPhotoFile) {
      setCameraError("Please capture or upload a clear face photo, or use Skip for now.");
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
      await finishGoogleSignup(profileImage, faceEmbedding);
    } catch (error: any) {
      console.error("Google signup completion failed", error);
      setCameraError(
        error?.message || "Unable to complete signup. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    try {
      if (!validateForm()) return;

      // Validate reCAPTCHA
      if (!recaptchaToken && isRecaptchaEnabled) {
        setFormErrors({
          ...formErrors,
          recaptcha: "Please complete the reCAPTCHA verification"
        });
        return;
      }

      setLoading(true);
      setFormErrors({});

      // Call backend login endpoint with reCAPTCHA token
      const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/login`;
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          recaptchaToken: isRecaptchaEnabled ? recaptchaToken : "NO_CAPTCHA",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      // If backend validation succeeds, proceed with Firebase login
      const result = await loginWithEmail(email, password);

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole,
        avatar: result.user.photoURL || "",
      });

      // Check for redirect param
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");

      if (redirectUrl) {
        navigate({ to: redirectUrl });
      } else {
        navigate({ to: `/${activeRole}` });
      }
    } catch (error: any) {
      console.error("Email Login Failed", error);

      // Reset reCAPTCHA on error
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken(null);
      }

      setFormErrors({
        ...formErrors,
        auth: (() => {
          const code = (error as any)?.code;
          if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Incorrect email or password. Please try again.";
          if (code === "auth/too-many-requests") return "Too many failed attempts. Please try again later.";
          if (code === "auth/user-disabled") return "Your account has been disabled. Please contact support.";
          if (code === "auth/network-request-failed") return "Network error. Please check your connection and try again.";
          return "Login failed. Please try again.";
        })()
      });
    } finally {
      setLoading(false);
    }
  };

  //SignUp

  const { mutateAsync: signupMutation, error: signupError, isError: isSignUpError } = useSignup();

  // New function for handling signup
  const handleEmailSignup = async () => {
    if (!validateForm()) return;

    // if (!passwordsMatch) {
    //   setFormErrors({
    //     ...formErrors,
    //     password: "Passwords do not match",
    //   });
    //   return;
    // }
    if (password !== confirmPassword) {
      setFormErrors({
        ...formErrors,
        password: "Passwords do not match",
      });
      return;
    }


    if (passwordStrength.value < 50) {
      setFormErrors({
        ...formErrors,
        password: "Please create a stronger password",
      });
      return;
    }

    if (!recaptchaToken && isRecaptchaEnabled) {
      setFormErrors({ ...formErrors, recaptcha: "Please complete the reCAPTCHA" });
      return;
    }

    try {
      setLoading(true);
      setFormErrors({});

      // Face photo is optional at signup; students can add it later when
      // they enter a course that requires face recognition.
      const profileImage =
        activeRole === "student" && studentPhotoFile
          ? await convertFileToDataUrl(studentPhotoFile)
          : undefined;
      const faceEmbedding =
        activeRole === "student" && studentPhotoFile
          ? (uploadEmbeddingRef.current || await generateFaceEmbedding(studentPhotoFile))
          : undefined;

      // const result = await createUserWithEmail(email, password, fullName);

      // Parse fullName into firstName and lastName
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';

      await signupMutation({
        body: {
          email: email,
          password: password,
          firstName: firstName,
          lastName: lastName,
          recaptchaToken: isRecaptchaEnabled ? recaptchaToken : "NO_CAPTCHA",
          profileImage,
          faceEmbedding,
        }
      });
      const result = await loginWithEmail(email, password);

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole,
        avatar: result.user.photoURL || "",
      });

      // Check for redirect param
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");

      if (redirectUrl) {
        navigate({ to: redirectUrl });
      } else {
        navigate({ to: "/student" });
      }

    } catch (error: any) {
      console.error("Email Signup Failed", error);
      console.log(signupError, isSignUpError);
      if (isSignUpError) {
        let message = "";
        if (signupError?.message === "Invalid body, check 'errors' property for more info.") {
          for (const error of signupError?.errors || []) {
            message += `${Object.values(error.constraints).join(', ')}`;
          }
        }
        else message = signupError?.message || "An error occurred during signup";

        setFormErrors({
          ...formErrors,
          auth: message || "Failed to create account. Please try again.",
          email: Object.values(signupError?.errors?.find((e: any) => e.property === 'email')?.constraints || {}).join(', ') || "",
          fullName:
            (Object.values(signupError?.errors?.find((e: any) => e.property === 'firstName')?.constraints || {}).join(', ') +
              (Object.values(signupError?.errors?.find((e: any) => e.property === 'lastName')?.constraints || {}).join(', '))).trim() || "",
          password: Object.values(signupError?.errors?.find((e: any) => e.property === 'password')?.constraints || {}).join(', ') || ""
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Redirect based on authenticated user role
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get("redirect");

    if (completeFaceMode) {
      // Stay on the page so the logged-in user can add their face photo.
      return;
    }

    if (isAuthenticated && user) {
      if (redirectUrl) {
        navigate({ to: redirectUrl });
      } else {
        // Redirect based on role
        if (user.role === 'teacher') {
          navigate({ to: '/teacher' });
        } else if (user.role === 'student') {
          navigate({ to: '/student' });
        }
      }
    }
  }, [isAuthenticated, user, navigate, completeFaceMode]);

  useEffect(() => {
    if (!isCameraOpen || !mediaStreamRef.current || !videoCaptureRef.current) {
      return;
    }

    const videoElement = videoCaptureRef.current;
    videoElement.srcObject = mediaStreamRef.current;

    const handleLoadedMetadata = () => {
      void videoElement.play().catch((error) => {
        console.error("Unable to start camera preview", error);
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

  const renderFaceRegistrationControls = (isOptional = false) => {
    const isUploaded = !!uploadEmbeddingRef.current;
    
    return (
      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        {/* Guidelines section */}
        <div className="space-y-3.5 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold uppercase tracking-wider">
              <Camera className="h-4 w-4" />
              Face Identity Guidelines
            </div>
            {isOptional ? (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border/40">
                Optional
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                Required
              </span>
            )}
          </div>
          
          <div className="rounded border border-destructive/20 bg-destructive/10 p-2.5 flex items-start gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-destructive">PERMANENT PHOTO</span>
              <p className="text-[10px] text-muted-foreground leading-snug">
                You cannot change your face reference photo after registration. It will be used to verify your attendance during courses.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span>Face centered & clear</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span>Good even lighting</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <span>No beauty filters</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <span>No accessories/hats</span>
            </div>
          </div>
        </div>

        {/* Action / Preview section */}
        {!studentPhotoPreview ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1 text-xs" onClick={openCamera}>
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                Use Webcam (Recommended)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
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
                    className="h-56 w-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  
                  {/* Live Tracking overlay checklist */}
                  <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm rounded p-2 text-[10px] text-white space-y-1 border border-white/10">
                    <div className="flex justify-between items-center font-semibold text-[9px] uppercase tracking-wider text-muted-foreground pb-0.5 border-b border-white/5">
                      <span>Webcam Quality</span>
                      <span className={liveChecks.overallPassed ? "text-green-400" : "text-amber-400 animate-pulse"}>
                        {liveChecks.overallPassed ? "Ready to Capture" : "Calibrating..."}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center gap-1">
                        {liveChecks.faceDetected ? (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400" />
                        )}
                        <span>Face detected</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {liveChecks.faceCentered ? (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400" />
                        )}
                        <span>Centered</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {liveChecks.properLighting ? (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400" />
                        )}
                        <span>Good light</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1 text-xs"
                    onClick={capturePhoto}
                    disabled={!liveChecks.overallPassed}
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    Capture Photo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 text-xs"
                    onClick={stopCameraStream}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Reference image</span>
                <img
                  src={studentPhotoPreview}
                  alt="Student preview"
                  className="h-36 w-full rounded-lg object-cover border border-border bg-card"
                />
              </div>

              {/* Upload Validation status */}
              {isUploaded ? (
                <div className="space-y-1 flex flex-col justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Quality Checks</span>
                  
                  <div className="space-y-1.5 rounded-lg border border-border bg-card p-2 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3 text-primary" /> Face:
                      </span>
                      <span className={uploadChecks.faceDetected ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {uploadChecks.faceDetected ? "OK" : "No"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3 text-primary" /> Centered:
                      </span>
                      <span className={uploadChecks.faceCentered ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {uploadChecks.faceCentered ? "OK" : "No"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Sun className="h-3 w-3 text-primary" /> Light:
                      </span>
                      <span className={uploadChecks.properLighting ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {uploadChecks.properLighting ? "OK" : "Bad"}
                      </span>
                    </div>

                    <div className="border-t border-border/80 pt-1.5 flex items-center justify-between font-semibold">
                      <span>Webcam match:</span>
                      <span className={
                        uploadChecks.matchesWebcam === true 
                          ? "text-green-600" 
                          : uploadChecks.matchesWebcam === false 
                          ? "text-red-600 animate-pulse" 
                          : "text-amber-500"
                      }>
                        {uploadChecks.matchesWebcam === true 
                          ? "Verified" 
                          : uploadChecks.matchesWebcam === false 
                          ? "Mismatch!" 
                          : "Required"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center border border-dashed rounded-lg h-36 text-muted-foreground text-[10px] p-3 text-center bg-card">
                  Photo captured directly from webcam is fully verified.
                </div>
              )}
            </div>

            {/* Verification live match camera */}
            {isVerifyingUpload && isCameraOpen && (
              <div className="space-y-2 rounded-lg border border-border p-2 bg-card">
                <div className="relative overflow-hidden rounded-lg bg-slate-950">
                  <video
                    ref={videoCaptureRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-36 w-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/75 backdrop-blur-sm rounded px-1.5 py-1 text-[9px] text-white flex items-center justify-between border border-white/10">
                    <span className="flex items-center gap-0.5 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> Live Verification
                    </span>
                    <span className={uploadChecks.matchesWebcam === true ? "text-green-400 font-semibold" : "text-amber-400 font-semibold"}>
                      {uploadChecks.matchesWebcam === true ? "Match Verified!" : "Analyzing..."}
                    </span>
                  </div>
                </div>
                
                {uploadChecks.matchesWebcam === false && (
                  <div className="text-[10px] text-destructive flex items-start gap-1 p-0.5">
                    <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>Face in webcam does not match uploaded file. Please use a current photo of yourself.</span>
                  </div>
                )}
              </div>
            )}

            {/* Webcam Match Prompt Button */}
            {isUploaded && !uploadChecks.matchesWebcam && !isVerifyingUpload && (
              <Button
                type="button"
                variant="destructive"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
                onClick={startWebcamVerification}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                Verify Photo via Webcam (Required)
              </Button>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  setStudentPhotoPreview("");
                  setStudentPhotoFile(null);
                  setCameraError("");
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
                }}
              >
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                Retake / Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={resetStudentPhoto}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
            
            {studentPhotoFile && !isUploaded && (
              <p className="text-[10px] text-muted-foreground text-center">
                Captured: {studentPhotoFile.name}
              </p>
            )}
          </div>
        )}

        {cameraError && (
          <div className="flex items-start gap-2 text-destructive text-[11px] mt-2 rounded bg-destructive/10 p-2 border border-destructive/20">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>{cameraError}</p>
          </div>
        )}
      </div>
    );
  };

  // Return the new beautiful auth page with Magic UI
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">

      {/* Animated Grid Background */}
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.1}
        duration={3}
        repeatDelay={1}
        className={cn(
          "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
          "absolute inset-0 h-full w-full",
        )}
      />


      <div className="relative z-10 flex flex-col lg:flex-row min-h-screen">



        <LeftHeroSection />

        {/* Right Side - Auth Forms */}
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-md space-y-8">
            <>
              {/* Back Button */}
              <div className="inline-flex items-center gap-3 px-4 py-2">
                <span className="text-md text-muted-foreground">Want to teach on ViBe?</span>
                <button
                  onClick={() => {
                    const searchParams = new URLSearchParams(window.location.search);
                    const redirectUrl = searchParams.get("redirect");
                    navigate({
                      to: "/select-role",
                      search: redirectUrl ? { redirect: redirectUrl } : undefined
                    });
                  }}
                  className="cursor-pointer text-md font-medium text-primary hover:text-primary/80 hover:underline hover:underline-offset-4 transition-colors"
                >
                  Switch role
                </button>
              </div>

              {/* Auth Card */}
              <Card className="relative overflow-hidden">
                <ShineBorder
                  shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  duration={8}
                  borderWidth={2}
                />

                {!isSignUp ? (
                  // Login Section
                  <div>
                    <CardHeader className="space-y-3 pb-6">
                      <CardTitle className="text-2xl">Welcome Back</CardTitle>
                      <CardDescription>Sign in to your account to continue</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Auth Error Alert */}
                      {formErrors.auth && (
                        <div className="rounded-lg border border-red-600 bg-destructive/10 p-3">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <p className="text-sm text-red-600 font-medium">{formErrors.auth}</p>
                          </div>
                        </div>
                      )}

                      {/* Email Field */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={cn(
                            "transition-all duration-200",
                            formErrors.email && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-destructive">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Password Field */}
                      <div className="space-y-2">
                        <Label htmlFor="password" className="font-medium">
                          Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            name="new-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={cn(
                              "transition-all duration-200",
                              formErrors.password && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          <Button variant="ghost" size="icon" aria-label="" className="absolute inset-y-0 right-1" onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? <EyeOff /> : <Eye />}
                          </Button>
                        </div>
                        {formErrors.password && (
                          <p className="text-xs text-destructive">{formErrors.password}</p>
                        )}
                      </div>

                      {/* reCAPTCHA */}
                      {isRecaptchaEnabled ?
                        <div className="flex justify-center scale-[0.95] origin-left">
                          <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            theme="dark"
                            onChange={(token) => {
                              setRecaptchaToken(token);
                              setFormErrors({ ...formErrors, recaptcha: undefined });
                            }}
                            onExpired={() => setRecaptchaToken(null)}
                            onErrored={() => {
                              setRecaptchaToken(null);
                              setFormErrors({
                                ...formErrors,
                                recaptcha: "reCAPTCHA error. Please try again."
                              });
                            }}
                          />
                          {formErrors.recaptcha && (
                            <p className="text-xs text-destructive">{formErrors.recaptcha}</p>
                          )}
                        </div> :
                        <></>}

                      {/* Login Button */}
                      <Button
                        className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        onClick={handleEmailLogin}
                        disabled={loading || (!recaptchaToken && isRecaptchaEnabled)}
                      >
                        {loading ? "Signing in..." : `Sign in as ${activeRole == "student" ? 'learner' : activeRole}`}
                      </Button>

                      {/* Divider */}
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <Separator />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            or continue with
                          </span>
                        </div>
                      </div>

                      {/* Google Login */}
                      <Button
                        variant="outline"
                        className="w-full h-11 font-medium border-2 hover:bg-muted/50 transition-all duration-200"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                      >
                        <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                      </Button>
                    </CardContent>

                    <CardFooter className="pt-4">
                      <div className="w-full flex items-center justify-center mt-4">
                        <span className=" text-sm text-right text-muted-foreground text-nowrap "> Don't have an account?</span>
                        <Button
                          variant="link"
                          className="-ml-2 text-sm text-muted-foreground hover:text-foreground"
                          onClick={toggleSignUpMode}
                        >
                          <span className="font-medium">Sign up</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </div>
                ) : (
                  // Sign Up Section
                  <div>
                    <CardHeader className="space-y-3 pb-6">
                      <CardTitle className="text-2xl">Create {activeRole === 'student' ? 'Student' : 'Instructor'} Account</CardTitle>
                      <CardDescription>
                        Join our learning community and start your educational journey
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Auth Error Alert */}
                      {formErrors.auth && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-sm text-destructive">{formErrors.auth}</p>
                          </div>
                        </div>
                      )}

                      {/* Full Name */}
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="font-medium">
                          Full Name
                        </Label>
                        <Input
                          id="fullName"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={cn(
                            "transition-all duration-200",
                            formErrors.fullName && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {formErrors.fullName && (
                          <p className="text-xs text-destructive">{formErrors.fullName}</p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={cn(
                            "transition-all duration-200",
                            formErrors.email && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-destructive">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Password with Strength Indicator */}
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="font-medium">
                          Password
                        </Label>
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={cn(
                            "transition-all duration-200",
                            formErrors.password && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {password && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Password strength</span>
                              <span className={cn(
                                "text-xs font-medium",
                                passwordStrength.value <= 25 && "text-red-500",
                                passwordStrength.value > 25 && passwordStrength.value <= 50 && "text-yellow-500",
                                passwordStrength.value > 50 && passwordStrength.value <= 75 && "text-blue-500",
                                passwordStrength.value > 75 && "text-green-500"
                              )}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all duration-300",
                                  passwordStrength.color
                                )}
                                style={{ width: `${passwordStrength.value}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Check className={cn(
                                  "h-3 w-3",
                                  password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'
                                )} />
                                8+ characters
                              </div>
                              <div className="flex items-center gap-1">
                                <Check className={cn(
                                  "h-3 w-3",
                                  /[A-Z]/.test(password) ? 'text-green-500' : 'text-muted-foreground'
                                )} />
                                Uppercase
                              </div>
                              <div className="flex items-center gap-1">
                                <Check className={cn(
                                  "h-3 w-3",
                                  /\d/.test(password) ? 'text-green-500' : 'text-muted-foreground'
                                )} />
                                Numbers
                              </div>
                              <div className="flex items-center gap-1">
                                <Check className={cn(
                                  "h-3 w-3",
                                  /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-500' : 'text-muted-foreground'
                                )} />
                                Special chars
                              </div>
                            </div>
                          </div>
                        )}
                        {formErrors.password && (
                          <p className="text-xs text-destructive">{formErrors.password}</p>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="font-medium">
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}

                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={cn(
                              "transition-all duration-200",
                              !passwordsMatch && confirmPassword && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          <Button variant="ghost" size="icon" aria-label="" className="absolute inset-y-0 right-1" onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? <EyeOff /> : <Eye />}
                          </Button>
                        </div>
                        {!passwordsMatch && confirmPassword && (
                          <p className="text-xs text-destructive">Passwords do not match</p>
                        )}
                      </div>

                      {activeRole === "student" && renderFaceRegistrationControls(true)}

                      {/* reCAPTCHA */}
                      {isRecaptchaEnabled ?
                        <div className="flex justify-center scale-[0.95] origin-left">
                          <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            theme="dark"
                            onChange={(token) => {
                              setRecaptchaToken(token);
                              setFormErrors({ ...formErrors, recaptcha: undefined });
                            }}
                          />
                          {formErrors.recaptcha && (
                            <div className="flex items-center space-x-2 text-destructive justify-center">
                              <AlertCircle className="h-4 w-4" />
                              <p className="text-xs">{formErrors.recaptcha}</p>
                            </div>
                          )}
                        </div>
                        : <></>}

                      {/* Sign Up Button */}
                      <Button
                        className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200"
                        onClick={handleEmailSignup}
                        disabled={!passwordsMatch || passwordStrength.value < 50 || loading || (!recaptchaToken && isRecaptchaEnabled)}
                      >
                        {loading ? "Creating account..." : "Create Account"}
                      </Button>
                    </CardContent>

                    <CardFooter>
                      <div className="w-full flex items-center justify-center mt-4">

                        <span className=" text-sm text-right text-muted-foreground text-nowrap "> Already have an account?</span>
                        <Button
                          variant="link"
                          className="-ml-2 text-sm text-muted-foreground hover:text-foreground"
                          onClick={toggleSignUpMode}
                        >
                          <span className=" font-medium">Sign in</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </div>
                )}
              </Card>
            </>
          </div>
        </div>
      </div>

      {googleSignupPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Add a face photo (optional)</CardTitle>
              <CardDescription>
                Hi {googleSignupPending.firstName || googleSignupPending.email}. You can
                add a face photo now for proctored courses, or skip and add it later
                when you enter a course that requires it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderFaceRegistrationControls(true)}
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={skipGoogleSignupPhoto}
                disabled={loading}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={completeGoogleSignup}
                disabled={loading || !studentPhotoFile || (!!uploadEmbeddingRef.current && !uploadChecks.overallPassed)}
              >
                {loading ? "Finishing…" : "Submit and continue"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {completeFaceMode && isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Face photo required</CardTitle>
              <CardDescription>
                The course you are entering requires face recognition. Please capture
                or upload a clear face photo to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderFaceRegistrationControls(false)}
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                className="w-full"
                onClick={saveFaceReference}
                disabled={loading || !studentPhotoFile || (!!uploadEmbeddingRef.current && !uploadChecks.overallPassed)}
              >
                {loading ? "Saving…" : "Save and continue"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
