import { loginWithGoogle, loginWithEmail, createUserWithEmail } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, createContext, useContext, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Github } from "lucide-react";
import { cn } from "@/utils/utils";
import { useSignup } from "@/hooks/hooks.ts";
import classroom from "../../../public/img/classroom.svg";
import learningImg from "../../../public/img/learning-img.svg";
import innovators from "../../../public/img/innovators.svg";
import logos from "../../../public/img/logos.png";
import vledLogo from "../../../public/img/vled-logo-login.png";
import iitLogo from "../../../public/img/iit-clear.png";

// Create a context for tab state management
const TabsContext = createContext<{
  value: string;
  onValueChange?: (value: string) => void;
}>({ value: "" });

const links = {
  GITHUB: 'https://github.com/vicharanashala/vibe.git',
  DEMO_VIDEO: "https://www.youtube.com/watch?v=8ytNdYlK-BU",
  ABOUT_US: "https://github.com/vicharanashala/vibe/blob/combined-updates/README.md"

}

// Create simplified versions of missing components
const Tabs = ({ defaultValue, className, children, value, onValueChange }: {
  defaultValue: string;
  className: string;
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}) => {
  // Use internal state if no value is provided (uncontrolled component)
  const [internalValue, setInternalValue] = useState(defaultValue);

  // Determine which value to use (controlled or uncontrolled)
  const activeValue = value !== undefined ? value : internalValue;

  // Handle value change
  const handleValueChange = (newValue: string) => {
    // Update internal state if uncontrolled
    if (value === undefined) {
      setInternalValue(newValue);
    }

    // Call external handler if provided
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={className} data-value={activeValue}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ className, children }: { className: string; children: React.ReactNode }) => {
  return <div className={className}>{children}</div>;
};

const TabsTrigger = ({ value, children, onClick }: {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  const { value: activeValue, onValueChange } = useContext(TabsContext);

  const handleClick = () => {
    if (onClick) onClick();
    if (onValueChange) onValueChange(value);
  };

  const isActive = activeValue === value;

  return (
    <button
      onClick={handleClick}
      className={`px-4 py-2 ${isActive ? "bg-background font-medium" : "text-muted-foreground"}`}
      data-value={value}
      data-state={isActive ? "active" : "inactive"}
    >
      {children}
    </button>
  );
};

export default function AuthPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // New state variables
  const [isSignUp, setIsSignUp] = useState(false);
  const [activeRole, setActiveRole] = useState<"teacher" | "student">("student");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
    auth?: string;
  }>({});
  const [showAuthForm, setShowAuthForm] = useState(false);

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

  const validateForm = () => {
    const errors: typeof formErrors = {};
    if (!fullName) errors.fullName = "Name is required";
    else if (!/^[A-Za-z ]+$/.test(fullName)) errors.fullName = "Name can only contain letters and spaces";

    if (!email) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Invalid email format";

    if (!password) errors.password = "Password is required";
    else if (isSignUp && password.length < 8) errors.password = "Password must be at least 8 characters";

    if (isSignUp && !fullName) errors.fullName = "Full name is required";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchBackendProfile = async (token: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to fetch backend profile", error);
      return null;
    }
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

      const token = await result.user.getIdToken();
      const backendProfile = await fetchBackendProfile(token);

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: `${backendProfile?.firstName || ""} ${backendProfile?.lastName || ""}`.trim() || result.user.displayName || "",
        firstName: backendProfile?.firstName || "",
        lastName: backendProfile?.lastName || "",
        role: activeRole, // Use the selected role from tabs
        avatar: backendProfile?.avatar || result.user.photoURL || "",
        gender: backendProfile?.gender || "",
        country: backendProfile?.country || "",
        state: backendProfile?.state || "",
        city: backendProfile?.city || "",
      });

      navigate({ to: `/${activeRole}` });
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
      setLoading(true);
      setFormErrors({});

      // This function now handles login only
      const result = await loginWithEmail(email, password);
      const token = await result.user.getIdToken();
      const backendProfile = await fetchBackendProfile(token);

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: `${backendProfile?.firstName || ""} ${backendProfile?.lastName || ""}`.trim() || result.user.displayName || "",
        firstName: backendProfile?.firstName || "",
        lastName: backendProfile?.lastName || "",
        role: activeRole,
        avatar: backendProfile?.avatar || result.user.photoURL || "",
        gender: backendProfile?.gender || "",
        country: backendProfile?.country || "",
        state: backendProfile?.state || "",
        city: backendProfile?.city || "",
      });

      navigate({ to: `/${activeRole}` });
    } catch (error) {
      console.error("Email Login Failed", error);
      setFormErrors({
        ...formErrors,
        auth: "Invalid email or password. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  //SignUp

  const { mutateAsync: signupMutation, error: signupError, isError: isSignUpError } = useSignup();

  // New function for handling signup
  const handleEmailSignup = async () => {
    // if (!validateForm()) return;

    if (!passwordsMatch) {
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

    try {
      setLoading(true);
      setFormErrors({});

      const result = await createUserWithEmail(email, password, fullName);

      // Parse fullName into firstName and lastName
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';

      await signupMutation({
        body: {
          email: email,
          password: password,
          firstName: firstName,
          lastName: lastName
        }
      });
      // const result = await loginWithEmail(email, password);

      const token = await result.user.getIdToken();
      const backendProfile = await fetchBackendProfile(token);

      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: `${backendProfile?.firstName || ""} ${backendProfile?.lastName || ""}`.trim() || result.user.displayName || "",
        firstName: backendProfile?.firstName || firstName,
        lastName: backendProfile?.lastName || lastName,
        role: activeRole,
        avatar: backendProfile?.avatar || result.user.photoURL || "",
        gender: backendProfile?.gender || "",
        country: backendProfile?.country || "",
        state: backendProfile?.state || "",
        city: backendProfile?.city || "",
      });

      navigate({ to: "/student" });

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
    if (isAuthenticated && user) {
      // Redirect based on role
      if (user.role === 'teacher') {
        navigate({ to: '/teacher' });
      } else if (user.role === 'student') {
        navigate({ to: '/student' });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const host = window.location.hostname;

    const studentSites = [
      'vibe.devabhasha.live',
      'vibe.gurusetu.org',
    ];

    if (studentSites.includes(host)) {
      navigate({ to: '/student/login' });
    } else {
      navigate({ to: '/auth' });
    }
  }, []);


  // Return the new beautiful auth page with Magic UI
  return (
    <div className="relative min-h-screen overflow-x-hidden">

      <div>
        {/* Left Side - Hero Section with Logos - Mobile & Desktop */}
        <div className="flex flex-col justify-center bg-[rgb(240,248,250)] relative lg:flex-1 px-4 sm:px-6">

          {/* Center Section with Content - Perfectly Centered */}
          <div className="flex flex-col justify-center space-y-10 w-full max-w-[1280px] mx-auto py-16 px-0 sm:px-2">
            {/* Main Text Content */}
            <div className="text-center space-y-6">
              <div className="flex justify-center items-center gap-6 mb-8">
                <img src={vledLogo} alt="VLED Logo" className="h-[60px] md:h-[80px] w-auto object-contain" />
                <img src={iitLogo} alt="IIT Logo" className="h-[50px] md:h-[70px] w-auto object-contain" />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[rgb(208,123,37)] font-bold tracking-tight leading-tight">
                Welcome to the Future of Learning
              </h1>
              {/* <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Connect, collaborate, and grow with our innovative educational platform designed for the next generation
              </p> */}
            </div>
            <div className="w-full justify-between flex lg:flex-row flex-col items-center gap-6">
              <div className="max-w-[560px] flex flex-col space-y-4">
                <h3 className="text-[rgb(25,90,105)] text-[36px] font-bold leading-10">
                  {"Empowering Education for All".split("").map((char, i) => (
                    <span key={i} className="inline-block transition-colors duration-300 hover:text-[rgba(228,143,57,1)] cursor-default">
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  ))}
                </h3>
                <p className="text-[rgba(228,143,57,1)] text-base font-normal leading-[26px]">Connect, collaborate, and grow with our innovative educational platform designed for the next generation</p>
                <div className="flex gap-3">
                  <button onClick={() => window.open(links.DEMO_VIDEO, '_blank')} className="text-base px-7 py-3 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                    Explore Demo
                  </button>
                  <button onClick={() => { navigate({ to: "/student/login" }) }} className="text-base px-7 py-3 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                    Get Started
                  </button>
                </div>
              </div>
              <div className="w-full min-w-[300px] max-w-[600px] h-[400px] rounded-[12px] overflow-hidden bg-black shadow-[0_12px_40px_rgba(0,0,0,0.15)]">
                <iframe
                  title="ViBe demo"
                  className="w-full h-full"
                  src={(function () {
                    // Replace the string below with your YouTube URL (watch or share link)
                    const youtubeUrl = links.DEMO_VIDEO;
                    try {
                      const u = new URL(youtubeUrl);
                      const v = u.searchParams.get("v");
                      if (v) return `https://www.youtube.com/embed/${v}`;
                      if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
                      return youtubeUrl; // already an embed URL or fallback
                    } catch {
                      return youtubeUrl;
                    }
                  })()}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div></div>
          </div>
        </div>
        <div className="bg-[#ffffff]">
          <div className="flex lg:flex-row flex-col items-center w-full max-w-[1280px] mx-auto py-16 px-4 sm:px-6">
            <div className="w-full lg:w-auto">
              <img src={classroom} alt="classroom image" className="w-full h-auto" />
            </div>
            <div className="max-w-[560px] ml-auto flex flex-col mt-8 lg:mt-0">
              <h3 className="text-[rgb(25,90,105)] text-[36px] font-bold leading-10 mb-16">
                {"Why Choose ViBe?".split("").map((char, i) => (
                  <span key={i} className="inline-block transition-colors duration-300 hover:text-[rgba(228,143,57,1)] cursor-default">
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                ))}
              </h3>
              <p className="text-[rgba(228,143,57,1)] text-base font-normal leading-[26px] mb-4">ViBe is an online learning platform that helps students stay engaged. It uses smart checks, quick quizzes, and flexible tools to make learning more active and honest.</p>
              <div>
                <button onClick={() => window.open(links.DEMO_VIDEO, '_blank')} className="text-base px-7 py-3 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                  Explore Demo

                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[rgb(224,242,246)]">
          <div className="flex lg:flex-row flex-col items-center w-full max-w-[1280px] mx-auto py-16 px-4 sm:px-6">
            <div className="w-full justify-between flex lg:flex-row flex-col items-center">
              <div className="max-w-[560px] flex flex-col">
                <h3 className="text-[rgb(25,90,105)] text-[36px] font-bold leading-10 mb-[84px]">
                  {"Transform Your Learning Experience".split("").map((char, i) => (
                    <span key={i} className="inline-block transition-colors duration-300 hover:text-[rgba(228,143,57,1)] cursor-default">
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  ))}
                </h3>
                <div className="flex flex-1 flex-col justify-center">
                  <div className={`mr-auto w-full ${showAuthForm ? 'md:max-w-[612px]' : 'lg:max-w-3xs max-w-full '} space-y-8`}>
                    <div>
                      <button
                        onClick={() => {
                          navigate({ to: "/student/login" })
                        }}
                        className="text-base px-7 py-3 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                        Continue To Login
                      </button>
                    </div>


                    {!showAuthForm ? (
                      <>
                        {/*<div className="space-y-4 flex lg:flex-col md:flex-row flex-col justify-between">
                          <Button 
                            onClick={() => {
                              setActiveRole('student');
                              setShowAuthForm(true);
                            }}
                            className="lg:w-full md:w-auto w-full h-14 text-lg border-0 !bg-[#C393E2]"
                            variant="outline"
                          >
                            <span className="flex items-center justify-center gap-2">
                              Continue as a Student
                            </span>
                          </Button>
                          
                          <Button 
                            onClick={() => {
                              setActiveRole('teacher');
                              setShowAuthForm(true);
                            }}
                            className="lg:w-full md:w-auto w-full h-14 text-lg border-0 !bg-[#C393E2]"
                            variant="outline"
                          >
                            <span className="flex items-center justify-center gap-2">
                              Continue as a Instructor
                            </span>
                          </Button>
                          </div>*/}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:!bg-[rgb(102,187,205)] -ml-2 mb-3.5"
                          onClick={() => setShowAuthForm(false)}
                        >
                          ← Back
                        </Button>

                        <Card className="relative overflow-hidden bg-[rgb(240,248,250)] border-0 rounded-[8px] pt-[75px] pb-[34px]">
                          {!isSignUp ? (
                            <div>
                              <CardHeader>
                                <CardTitle className="text-3xl md:text-4xl text-center text-[rgb(25,90,105)] font-bold leading-tight mb-10 md:mb-[60px]">Welcome Back</CardTitle>
                              </CardHeader>

                              <CardContent className="space-y-10 md:px-20 px-5">
                                {formErrors.auth && (
                                  <div className="rounded-lg border border-red-600 bg-destructive/10 p-3">
                                    <div className="flex items-center space-x-2">
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <p className="text-sm text-red-600 font-medium">{formErrors.auth}</p>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      formErrors.email && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {formErrors.email && (
                                    <p className="text-xs text-destructive">{formErrors.email}</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Input
                                    id="password"
                                    name="new-password"
                                    type="password"
                                    placeholder="Enter your password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      formErrors.password && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {formErrors.password && (
                                    <p className="text-xs text-destructive">{formErrors.password}</p>
                                  )}
                                </div>
                                <div className="w-full max-w-[294px] mx-auto">
                                  <Button
                                    className="w-full h-16 text-lg mb-0 font-semibold !bg-[rgb(52,152,169)] hover:!bg-[rgb(102,187,205)] text-white shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300"
                                    onClick={handleEmailLogin}
                                    disabled={loading}
                                  >
                                    {loading ? "Signing in..." : `Sign in as ${activeRole=="student"?'learner':activeRole}`}
                                  </Button>
                                </div>

                                <div className="relative my-6">
                                  <div className="relative flex justify-center text-xs uppercase">
                                    <span className="text-[rgb(52,152,169)] text-xl font-semibold">
                                      OR
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full max-w-[294px] mx-auto">
                                  <Button
                                    variant="outline"
                                    className="w-full h-16 text-lg font-semibold !bg-[rgb(52,152,169)] hover:!bg-[rgb(102,187,205)] text-white border-0 shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300"
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
                                </div>
                              </CardContent>

                              <CardFooter className="pt-12 md:px-20 px-5">
                                <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
                                  <div className="flex-1 bg-white text-[#6B7280] text-base font-medium rounded-md flex items-center justify-center px-3 sm:px-4 whitespace-nowrap">
                                    Don’t have an account?
                                  </div>
                                  <button
                                    onClick={toggleSignUpMode}
                                    className="py-3 px-[29px] text-base rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer"
                                  >
                                    Sign Up
                                  </button>
                                </div>
                              </CardFooter>
                            </div>
                          ) : (
                            <div>
                              <CardHeader>
                                <CardTitle className="text-3xl md:text-4xl text-center text-[rgb(25,90,105)] font-bold leading-tight mb-10 md:mb-[60px]">Create {activeRole === 'student' ? 'Student' : 'Instructor'} Account</CardTitle>
                              </CardHeader>

                              <CardContent className="space-y-5 md:px-20 px-5">
                                {formErrors.auth && (
                                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                                    <div className="flex items-center space-x-2">
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                      <p className="text-sm text-destructive">{formErrors.auth}</p>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Input
                                    id="fullName"
                                    placeholder="Enter your full name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      formErrors.fullName && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {formErrors.fullName && (
                                    <p className="text-xs text-destructive">{formErrors.fullName}</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Input
                                    id="signup-email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      formErrors.email && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {formErrors.email && (
                                    <p className="text-xs text-destructive">{formErrors.email}</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Input
                                    id="signup-password"
                                    type="password"
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      formErrors.password && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {password && (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-[rgb(52,152,169)]">Password strength</span>
                                        <span className={cn(
                                          "text-xs font-medium",
                                          passwordStrength.value <= 25 && "text-red-500",
                                          passwordStrength.value > 25 && passwordStrength.value <= 50 && "text-yellow-500",
                                          passwordStrength.value > 50 && passwordStrength.value <= 75 && "text-[rgb(52,152,169)]",
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
                                      <div className="grid grid-cols-2 gap-1 text-xs text-[rgb(52,152,169)]">
                                        <div className="flex items-center gap-1">
                                          <Check className={cn(
                                            "h-3 w-3",
                                            password.length >= 8 ? 'text-green-500' : 'text-[rgb(52,152,169)]'
                                          )} />
                                          8+ characters
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Check className={cn(
                                            "h-3 w-3",
                                            /[A-Z]/.test(password) ? 'text-green-500' : 'text-[rgb(52,152,169)]'
                                          )} />
                                          Uppercase
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Check className={cn(
                                            "h-3 w-3",
                                            /\d/.test(password) ? 'text-green-500' : 'text-[rgb(52,152,169)]'
                                          )} />
                                          Numbers
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Check className={cn(
                                            "h-3 w-3",
                                            /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-500' : 'text-[rgb(52,152,169)]'
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

                                <div className="space-y-2">
                                  <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className={cn(
                                      "transition-all duration-200 border-0 !bg-[#FFFFFF] placeholder:text-[#9CA3AF] text-[#000000] text-lg h-16",
                                      !passwordsMatch && confirmPassword && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                  {!passwordsMatch && confirmPassword && (
                                    <p className="text-xs text-destructive">Passwords do not match</p>
                                  )}
                                </div>
                                <div className="w-full max-w-[294px] mx-auto">
                                  <Button
                                    className="w-full h-16 text-lg font-semibold !bg-[rgb(52,152,169)] hover:!bg-[rgb(102,187,205)] text-white border-0 shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300"
                                    onClick={handleEmailSignup}
                                    disabled={!passwordsMatch || passwordStrength.value < 50 || loading}
                                  >
                                    {loading ? "Creating account..." : "Create Account"}
                                  </Button>
                                </div>
                              </CardContent>

                              <CardFooter className="pt-5 md:px-20 px-5">
                                <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
                                  <div className="flex-1 bg-white text-[#6B7280] text-base font-medium rounded-md flex items-center justify-center px-3 sm:px-4 whitespace-nowrap">
                                    Already have an account?
                                  </div>
                                  <button
                                    onClick={toggleSignUpMode}
                                    className="py-3 px-[29px] text-base rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer"
                                  >
                                    Sign in
                                  </button>
                                </div>
                              </CardFooter>
                            </div>
                          )}
                        </Card>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <img src={learningImg} alt="learning image" className="w-full h-auto mt-8 lg:mt-0" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#ffffff]">
          <div className="flex lg:flex-row flex-col items-center w-full max-w-[1280px] mx-auto py-16 px-4 sm:px-6">
            <div className="w-full lg:w-auto">
              <img src={innovators} alt="innovators image" className="w-full h-auto" />
            </div>
            <div className="max-w-[560px] ml-auto flex flex-col space-y-4 mt-8 lg:mt-0">
              <h3 className="text-[rgb(25,90,105)] text-[36px] font-bold leading-10">
                {"Join a Community of Innovators".split("").map((char, i) => (
                  <span key={i} className="inline-block transition-colors duration-300 hover:text-[rgba(228,143,57,1)] cursor-default">
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                ))}
              </h3>
              <p className="text-[rgba(228,143,57,1)] text-base font-normal leading-[26px]">Learn how ViBe is reshaping education through collaboration and technology, empowering learners to thrive.</p>
              <div>
                <button onClick={() => window.open(links.GITHUB, '_blank')} className="text-base px-7 py-3 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 cursor-pointer">
                  <Github className="w-5 h-5" />
                  GitHub Link
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[rgb(240,248,250)]">
          <div className="w-full max-w-[1280px] mx-auto py-16 px-4 sm:px-6">
            <h3 className="text-[rgb(25,90,105)] text-2xl sm:text-3xl md:text-[36px] font-bold leading-10 mb-[52px]">
              {"Funded by".split("").map((char, i) => (
                <span key={i} className="inline-block transition-colors duration-300 hover:text-[rgba(228,143,57,1)] cursor-default">
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </h3>
            <div className="flex flex-wrap items-center justify-center">
              {/* <img src={iitClear} alt="IIT Ropar Logo" className="w-[120px] sm:w-[145px] h-auto object-contain" />
              <img src={ugcLogo} alt="ugcLogo" className="w-[120px] sm:w-[145px] h-auto object-contain" />
              <img src={annam} alt="annam Logo" className="w-[120px] sm:w-[145px] h-auto object-contain" />
              <img src={vledLogo} alt="VLED Logo" className="w-[220px] sm:w-[260px] h-auto object-contain" /> */}
              <img src={logos} alt="Logos" style={{ transform: 'scale(1)' }} className="h-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-[rgb(25,90,105)] to-[rgb(40,120,135)]">
          <div className="w-full max-w-[1280px] mx-auto py-16 px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold leading-8 text-white">Stay Connected</h3>
                <div className="border-[0.5px] border-solid border-[#4B5563] w-32"></div>
                <p className="text-[#9CA3AF] text-base font-normal leading-6">
                  Your journey starts here.
                </p>
              </div>
              <div className="flex flex-col space-y-2 text-white text-base font-semibold leading-6">
                <a href="#">Home</a>
                <a href={links.ABOUT_US} target="_blank">About Us</a>
                <a href={links.GITHUB} target="_blank">Resources</a>
                <a href={links.GITHUB} target="_blank">Contact Us</a>
              </div>
            </div>
            <div className="bg-[rgb(240,248,250)] p-8 rounded-[8px] w-full max-w-[608px] ml-auto">
              <h4 className="text-[rgb(25,90,105)] text-base font-bold mb-4">
                Sign up for updates and insights.
              </h4>
              <div className="flex lg:flex-row flex-col items-stretch gap-2">
                <input
                  type="email"
                  placeholder="Your email address"
                  className="flex-1 px-4 py-3 placeholder:text-[#9CA3AF] text-[rgb(25,90,105)] rounded-md bg-[#FFFFFF] border border-[rgb(102,187,205)] focus:outline-none focus:ring-2 focus:ring-[rgb(52,152,169)]"
                />
                <button className="py-3 px-[29px] rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer">
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



