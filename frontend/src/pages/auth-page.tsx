import { loginWithGoogle, loginWithEmail, createUserWithEmail } from "@/lib/firebase";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, createContext, useContext, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, AlertCircle } from "lucide-react";

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

const TabsContent = ({ value, className, children }: { 
  value: string; 
  className: string; 
  children: React.ReactNode 
}) => {
  const { value: activeValue } = useContext(TabsContext);
  
  // Only render content when this tab is active
  if (value !== activeValue) return null;
  
  return <div className={className} data-tab-value={value}>{children}</div>;
};

const Progress = ({ value, className }: { value: number; className: string }) => {
  return <div className={className} style={{ width: `${value}%` }}></div>;
};

const Alert = ({ variant, className, children }: { 
  variant?: string; 
  className?: string; 
  children: React.ReactNode 
}) => {
  return <div className={`${className} ${variant === "destructive" ? "bg-red-100 text-red-800" : ""} p-2 rounded flex items-center`}>{children}</div>;
};

const AlertDescription = ({ children }: { children: React.ReactNode }) => {
  return <div className="ml-2">{children}</div>;
};

export default function AuthPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // New state variables
  const [isSignUp, setIsSignUp] = useState(false);
  const [activeRole, setActiveRole] = useState<"teacher" | "student">("teacher");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
    phoneNumber?: string;
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

  // New function for handling signup
  const handleEmailSignup = async () => {
    if (!validateForm()) return;
    
    // Additional signup validation
    if (!passwordsMatch) {
      setFormErrors({
        ...formErrors,
        password: "Passwords do not match"
      });
      return;
    }
    
    if (passwordStrength.value < 50) {
      setFormErrors({
        ...formErrors,
        password: "Please create a stronger password"
      });
      return;
    }
    
    try {
      setLoading(true);
      setFormErrors({});
      
      // Create the user account
      const result = await createUserWithEmail(email, password, fullName);
      
      // Set user in store - always student for signup
      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: fullName,
        role: "student", // Sign up is always for students
        avatar: result.user.photoURL || ""
      });
      
      // Navigate to student dashboard
      navigate({ to: "/student" });
    } catch (error: unknown) {
      console.error("Email Signup Failed", error);
      // Handle specific Firebase errors
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/email-already-in-use') {
        setFormErrors({
          ...formErrors,
          auth: "This email is already in use. Please try logging in instead."
        });
      } else {
        setFormErrors({
          ...formErrors,
          auth: "Failed to create account. Please try again."
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

  // Return the new two-column layout
  return (
    <div className="relative h-screen flex-col items-center justify-center md:grid lg:grid-cols-2 px-0">
      <div className="relative h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          Vibe
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Vibe is an innovative learning platform connecting students and teachers
              in a collaborative digital environment. Experience seamless interaction,
              real-time feedback, and personalized educational resources."
            </p>
            <footer className="text-sm">Education for everyone</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8 p-4">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome to Vibe
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Create your student account" : "Connect, learn, and grow together"}
            </p>
          </div>

          {/* Only show tabs when not in sign up mode */}
          {!isSignUp ? (
            <Tabs 
              defaultValue="teacher" 
              className="w-full" 
              onValueChange={(v: string) => setActiveRole(v as "teacher" | "student")}
              value={activeRole}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="teacher">Teacher</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
              </TabsList>
              
              <TabsContent value="teacher" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Login as Teacher</CardTitle>
                    <CardDescription>
                      Access your dashboard and connect with students
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show error alert if authentication fails */}
                    {formErrors.auth && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{formErrors.auth}</AlertDescription>
                      </Alert>
                    )}

                    {/* Email field */}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        placeholder="name@example.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)} 
                        className={formErrors.email ? "border-destructive" : ""}
                      />
                      {formErrors.email && (
                        <p className="text-destructive text-xs mt-1">{formErrors.email}</p>
                      )}
                    </div>
                    
                    {/* Password field */}
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        className={formErrors.password ? "border-destructive" : ""}
                      />
                      {formErrors.password && (
                        <p className="text-destructive text-xs mt-1">{formErrors.password}</p>
                      )}
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleEmailLogin}
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Login with Email"}
                    </Button>
                    
                    {/* Google login option */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
                      <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Google
                    </Button>
                  </CardContent>
                  <CardFooter>
                    <Button variant="link" className="w-full" onClick={toggleSignUpMode}>
                      Don't have an account? Sign Up
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Student tab for login */}
              <TabsContent value="student" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Login as Student</CardTitle>
                    <CardDescription>
                      Continue your learning journey with us
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show error alert if authentication fails */}
                    {formErrors.auth && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{formErrors.auth}</AlertDescription>
                      </Alert>
                    )}

                    {/* Email field */}
                    <div className="space-y-2">
                      <Label htmlFor="student-email">Email</Label>
                      <Input 
                        id="student-email" 
                        placeholder="name@example.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)} 
                        className={formErrors.email ? "border-destructive" : ""}
                      />
                      {formErrors.email && (
                        <p className="text-destructive text-xs mt-1">{formErrors.email}</p>
                      )}
                    </div>
                    
                    {/* Password field */}
                    <div className="space-y-2">
                      <Label htmlFor="student-password">Password</Label>
                      <Input 
                        id="student-password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        className={formErrors.password ? "border-destructive" : ""}
                      />
                      {formErrors.password && (
                        <p className="text-destructive text-xs mt-1">{formErrors.password}</p>
                      )}
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleEmailLogin}
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Login with Email"}
                    </Button>
                    
                    {/* Google login option */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
                      <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Google
                    </Button>
                  </CardContent>
                  <CardFooter>
                    <Button variant="link" className="w-full" onClick={toggleSignUpMode}>
                      Don't have an account? Sign Up
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            // Sign up form - no role tabs, always student
            <Card>
              <CardHeader>
                <CardTitle>Sign Up as Student</CardTitle>
                <CardDescription>
                  Join your classes and access learning materials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show error alert if authentication fails */}
                {formErrors.auth && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formErrors.auth}</AlertDescription>
                  </Alert>
                )}

                {/* Sign up fields */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="John Doe" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)} 
                    className={formErrors.fullName ? "border-destructive" : ""}
                  />
                  {formErrors.fullName && (
                    <p className="text-destructive text-xs mt-1">{formErrors.fullName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input 
                    id="phoneNumber" 
                    placeholder="+1 (555) 123-4567" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    className={formErrors.phoneNumber ? "border-destructive" : ""}
                  />
                  {formErrors.phoneNumber && (
                    <p className="text-destructive text-xs mt-1">{formErrors.phoneNumber}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)} 
                    className={formErrors.email ? "border-destructive" : ""}
                  />
                  {formErrors.email && (
                    <p className="text-destructive text-xs mt-1">{formErrors.email}</p>
                  )}
                </div>
                
                {/* Password field with strength indicator */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                    className={formErrors.password ? "border-destructive" : ""}
                  />
                  {password && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Password strength</span>
                        <span className="text-xs font-medium">{passwordStrength.label}</span>
                      </div>
                      <Progress 
                        value={passwordStrength.value} 
                        className={`h-1 ${passwordStrength.color}`} 
                      />
                      <ul className="text-xs space-y-1 mt-2 text-muted-foreground">
                        <li className="flex items-center gap-1">
                          <Check className={`h-3 w-3 ${password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`} /> 
                          At least 8 characters
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className={`h-3 w-3 ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} /> 
                          Include uppercase letters
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className={`h-3 w-3 ${/\d/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} /> 
                          Include numbers
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className={`h-3 w-3 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} /> 
                          Include special characters
                        </li>
                      </ul>
                    </div>
                  )}
                  {formErrors.password && (
                    <p className="text-destructive text-xs mt-1">{formErrors.password}</p>
                  )}
                </div>
                
                {/* Confirm password field */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className={!passwordsMatch ? "border-destructive" : ""}
                  />
                  {!passwordsMatch && confirmPassword && (
                    <p className="text-destructive text-xs mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleEmailSignup}
                  disabled={!passwordsMatch || passwordStrength.value < 33 || loading}
                >
                  {loading ? "Signing up..." : "Sign Up with Email"}
                </Button>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="w-full" onClick={toggleSignUpMode}>
                  Already have an account? Login
                </Button>
              </CardFooter>
            </Card>
          )}
          
          <p className="px-7 text-center text-xs text-muted-foreground">
            By clicking continue, you agree to our{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
