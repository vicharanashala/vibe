import { loginWithGoogle, loginWithEmail } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, AlertCircle, Eye, EyeOff, Camera, Upload, RefreshCcw, X } from "lucide-react";
import { ShineBorder } from "@/components/magicui/shine-border";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { cn } from "@/utils/utils";
import { useSignup } from "@/hooks/hooks.ts";
import ReCAPTCHA from "react-google-recaptcha";
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
  const videoCaptureRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceModelsLoadedRef = useRef(false);

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
      // Check if the user is new
      if (result._tokenResponse.isNewUser) {
        // If new user, set the default role to student
        setActiveRole("student");
        const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/signup/google/`;
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${result._tokenResponse.idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: result.user.email,
            firstName: result._tokenResponse.firstName,
            lastName: result._tokenResponse.lastName,
          }),
        });
      }

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole, // Use the selected role from tabs
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
    } catch (error) {
      console.error("Google Login Failed", error);
      setFormErrors({
        ...formErrors,
        auth: "Failed to sign in with Google. Please try again."
      });
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
        auth: error.message || "Invalid email or password. Please try again."
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

    if (activeRole === "student" && !studentPhotoFile) {
      setFormErrors({
        ...formErrors,
        auth: "Student registration requires a clear face photo for verification.",
      });
      return;
    }

    try {
      setLoading(true);
      setFormErrors({});

      const profileImage =
        activeRole === "student" && studentPhotoFile
          ? await convertFileToDataUrl(studentPhotoFile)
          : undefined;
      const faceEmbedding =
        activeRole === "student" && studentPhotoFile
          ? await generateFaceEmbedding(studentPhotoFile)
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
  }, [isAuthenticated, user, navigate]);

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

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (studentPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
    };
  }, [studentPhotoPreview]);



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

                      {activeRole === "student" && (
                        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                          <div className="space-y-1">
                            <Label className="font-medium">Student Photo</Label>
                            <p className="text-xs text-muted-foreground">
                              Add a clear face photo using your webcam or by uploading an image.
                            </p>
                          </div>

                          {!studentPhotoPreview ? (
                            <div className="space-y-3">
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  type="button"
                                  className="flex-1"
                                  onClick={openCamera}
                                >
                                  <Camera className="mr-2 h-4 w-4" />
                                  Use webcam
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload photo
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
                                  />
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                      type="button"
                                      className="flex-1"
                                      onClick={capturePhoto}
                                    >
                                      <Camera className="mr-2 h-4 w-4" />
                                      Capture photo
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
                                  onClick={openCamera}
                                >
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Retake
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Replace
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="flex-1 text-red-600 hover:text-red-700"
                                  onClick={resetStudentPhoto}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                              {studentPhotoFile && (
                                <p className="text-xs text-muted-foreground">
                                  Selected: {studentPhotoFile.name}
                                </p>
                              )}
                            </div>
                          )}

                          {cameraError && (
                            <p className="text-xs text-destructive">{cameraError}</p>
                          )}
                        </div>
                      )}

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
    </div>
  );
}
