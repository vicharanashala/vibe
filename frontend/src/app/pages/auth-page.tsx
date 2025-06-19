import { loginWithGoogle, loginWithEmail, createUserWithEmail } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, createContext, useContext, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, AlertCircle } from "lucide-react";
import { ShineBorder } from "@/components/magicui/shine-border";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { AuroraText } from "@/components/magicui/aurora-text";
import { cn } from "@/utils/utils";
import { useSignup } from "@/hooks/hooks.ts";

// Create a context for tab state management
const TabsContext = createContext<{
  value: string;
  onValueChange?: (value: string) => void;
}>({ value: "" });

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
      
      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole, // Use the selected role from tabs
        avatar: result.user.photoURL || "",
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
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      setFormErrors({});
      
      // This function now handles login only
      const result = await loginWithEmail(email, password);
      
      // Set user in store
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole,
        avatar: result.user.photoURL || "",
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

const signupMutation = useSignup();
  
  // New function for handling signup
  const handleEmailSignup = async () => {
    if (!validateForm()) return;
  
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
  
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: fullName,
        role: "student",
        avatar: result.user.photoURL || ""
      });
  
      await signupMutation.mutateAsync({
        body: {
          uid: result.user.uid,
          name: fullName,
          email: result.user.email || email,
          avatar: result.user.photoURL || "",
          role: "student",
        }
      });
  
      navigate({ to: "/student" });
  
    } catch (error: any) {
      console.error("Email Signup Failed", error);
      if (error?.code === "auth/email-already-in-use") {
        setFormErrors({
          ...formErrors,
          auth: "This email is already in use. Please try logging in instead.",
        });
      } else {
        setFormErrors({
          ...formErrors,
          auth: "Failed to create account. Please try again.",
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
        {/* Left Side - Hero Section with Logos - Mobile & Desktop */}
        <div className="flex flex-col justify-center items-center p-6 lg:p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative lg:flex-1 min-h-[40vh] lg:min-h-screen">
          {/* Top Section with Brand - Positioned Absolutely */}
          <div className="absolute top-8 left-8 flex items-center space-x-4">
            <div className="h-12 w-12 rounded-lg overflow-hidden">
              <img 
                src="https://continuousactivelearning.github.io/vibe/img/logo.png" 
                alt="Vibe Logo" 
                className="h-12 w-12 object-contain"
              />
            </div>
            <span className="text-3xl font-bold">
              <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}>Vibe</AuroraText>
            </span>
          </div>

          {/* Center Section with Content - Perfectly Centered */}
          <div className="flex flex-col items-center justify-center space-y-10 max-w-2xl mx-auto py-12">
            {/* Main Text Content */}
            <div className="text-center space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Welcome to the Future of{" "}
                <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}>Learning</AuroraText>
              </h1>
              <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Connect, collaborate, and grow with our innovative educational platform designed for the next generation
              </p>
            </div>
            
            {/* Institutional Logos - 2x2 Grid with Better Spacing */}
            <div className="w-full max-w-lg">
              <div className="text-center mb-6">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  A Collaboration Between
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Card className="relative overflow-hidden bg-white backdrop-blur-sm border-2 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                  <ShineBorder 
                  shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  className="absolute inset-0"
                  />
                  <div className="relative p-2 flex items-center justify-center h-28 bg-white">
                  <img 
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIMLYKMDSyb-jHjoXCgqylITmmVNGIxwMfKg&s" 
                    alt="IIT Ropar" 
                    className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  </div>
                </Card>

                <Card className="relative overflow-hidden bg-white backdrop-blur-sm border-2 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                  <ShineBorder 
                  shineColor={["#FE8FB5", "#FFBE7B", "#A07CFE"]}
                  className="absolute inset-0"
                  />
                  <div className="relative p-2 flex items-center justify-center h-28 bg-white">
                  <img 
                    src="https://mmc.ugc.ac.in/newtheme/img/ugc_logo.png" 
                    alt="UGC Logo" 
                    className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  </div>
                </Card>

                <Card className="relative overflow-hidden bg-white backdrop-blur-sm border-2 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                  <ShineBorder 
                  shineColor={["#FFBE7B", "#A07CFE", "#FE8FB5"]}
                  className="absolute inset-0"
                  />
                  <div className="relative p-2 flex items-center hover:scale-110 duration-300 justify-center h-28 bg-white">
                  <img 
                  src="https://annam.ai/wp-content/uploads/2025/01/4-1-768x768.png" 
                  alt="Annam Logo" 
                  style={{ scale: 2.3, transform: 'translateY(5px)' }}
                  className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  </div>
                </Card>

                <Card className="relative overflow-hidden bg-white backdrop-blur-sm border-2 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                  <ShineBorder 
                  shineColor={["#A07CFE", "#FFBE7B", "#FE8FB5"]}
                  className="absolute inset-0"
                  />
                  <div className="relative p-2 flex items-center hover:scale-110 duration-300 justify-center h-28 bg-white/95">
                  <img 
                    src="https://dled-lab.github.io/logo.png" 
                    alt="Dhananjaya Lab Logo"
                    style={{ scale: 2.5}}
                    className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-md space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-muted-foreground">
                {isSignUp 
                  ? "Join thousands of learners worldwide" 
                  : "Sign in to your account to continue"
                }
              </p>
            </div>

            {/* Auth Card with Shine Border */}
            <Card className="relative overflow-hidden">
              <ShineBorder 
                shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} 
                duration={8}
                borderWidth={2}
              />
              
              {!isSignUp ? (
                // Login Section
                <div>
                  {/* Role Selection Tabs */}
                  <CardHeader className="pb-4">
                    <Tabs 
                      defaultValue="student" 
                      className="w-full" 
                      onValueChange={(v: string) => setActiveRole(v as "student" | "teacher")}
                      value={activeRole}
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="student">Student</TabsTrigger>
                        <TabsTrigger value="teacher">Teacher</TabsTrigger>
                        
                      </TabsList>
                    </Tabs>
                  </CardHeader>

                  <CardContent className="space-y-4">{/* Content based on activeRole */}
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
                      <Label htmlFor="email" className="text-sm font-medium">
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
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input 
                        id="password" 
                        name="new-password"
                        type="password" 
                        placeholder="Enter your password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        className={cn(
                          "transition-all duration-200",
                          formErrors.password && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {formErrors.password && (
                        <p className="text-xs text-destructive">{formErrors.password}</p>
                      )}
                    </div>

                    {/* Login Button */}
                    <Button 
                      className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200"
                      onClick={handleEmailLogin}
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : `Sign in as ${activeRole}`}
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
                    <Button 
                      variant="link" 
                      className="w-full text-sm text-muted-foreground hover:text-foreground" 
                      onClick={toggleSignUpMode}
                    >
                      Don't have an account? <span className="ml-1 font-medium">Sign up</span>
                    </Button>
                  </CardFooter>
                </div>
              ) : (
                // Sign Up Section
                <div>
                  <CardHeader>
                    <CardTitle className="text-xl">Create Student Account</CardTitle>
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
                      <Label htmlFor="fullName" className="text-sm font-medium">
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
                      <Label htmlFor="signup-email" className="text-sm font-medium">
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
                      <Label htmlFor="signup-password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input 
                        id="signup-password" 
                        type="password" 
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
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">
                        Confirm Password
                      </Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className={cn(
                          "transition-all duration-200",
                          !passwordsMatch && confirmPassword && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {!passwordsMatch && confirmPassword && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>

                    {/* Sign Up Button */}
                    <Button 
                      className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200"
                      onClick={handleEmailSignup}
                      disabled={!passwordsMatch || passwordStrength.value < 50 || loading}
                    >
                      {loading ? "Creating account..." : "Create Account"}
                    </Button>
                  </CardContent>

                  <CardFooter>
                    <Button 
                      variant="link" 
                      className="w-full text-sm text-muted-foreground hover:text-foreground" 
                      onClick={toggleSignUpMode}
                    >
                      Already have an account? <span className="ml-1 font-medium">Sign in</span>
                    </Button>
                  </CardFooter>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
