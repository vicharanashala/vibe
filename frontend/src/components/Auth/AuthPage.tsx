import { loginWithGoogle, loginWithEmail, resetPassword, auth, setPersistence, browserLocalPersistence, browserSessionPersistence } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { LeftHeroSection } from "@/components/Auth/LeftHeroSection";

type AuthPageProps = {
  role?: "teacher" | "student";
};

export default function AuthPage({ role }: AuthPageProps) {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState(localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(localStorage.getItem("rememberMe") === "true");

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [formErrors, setFormErrors] = useState<any>({});

  // Forgot Password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const activeRole = role || "student";

  const toggleSignUpMode = () => {
    setIsSignUp(!isSignUp);
    setFormErrors({});
  };

  const handleForgotPassword = async () => {
    setResetError("");
    setResetMessage("");

    if (!resetEmail) {
      setResetError("Please enter your email address");
      return;
    }

    try {
      setResetLoading(true);
      const result = await resetPassword(resetEmail);

      if (result.success) {
        setResetMessage("Check your inbox for the reset link!");
        setResetEmail("");
      } else {
        setResetError(result.message || "Failed to send reset email");
      }
    } catch (error: any) {
      setResetError(error.message || "An error occurred. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setLoading(true);
      setFormErrors({});

      // Set persistence based on rememberMe preference
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result = await loginWithEmail(email, password);

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberMe");
      }

      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole,
        avatar: result.user.photoURL || "",
      });

      navigate({ to: `/${activeRole}` });

    } catch {
      setFormErrors({ auth: "Invalid email or password" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      const result = await loginWithGoogle();

      setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        name: result.user.displayName || "",
        role: activeRole,
        avatar: result.user.photoURL || "",
      });

      navigate({ to: `/${activeRole}` });

    } catch {
      setFormErrors({ auth: "Google login failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setFormErrors({ auth: "Fill all fields" });
      return;
    }

    if (password !== confirmPassword) {
      setFormErrors({ auth: "Passwords do not match" });
      return;
    }

    setFormErrors({ auth: "Account created successfully (mock)" });
  };

  return (
    <div className="relative min-h-screen flex">

      <LeftHeroSection />

      <div className="flex flex-1 items-center justify-center flex-col">

        <div className="mb-4 text-sm">
          Want to teach on ViBe?{" "}
          <button
            className="text-primary underline"
            onClick={() => navigate({ to: "/select-role" })}
          >
            Switch role
          </button>
        </div>

        <Card className="w-[400px]">

          {!isSignUp ? (
            <>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Sign in to continue</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">

                {formErrors.auth && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle size={16} /> {formErrors.auth}
                  </div>
                )}

                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                {/* PASSWORD WITH TOGGLE */}
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember Me
                  </label>

                  <button
                    className="text-sm text-primary"
                    onClick={() => {
                      setShowForgotModal(true);
                      setResetEmail(email);
                      setResetMessage("");
                      setResetError("");
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button onClick={handleEmailLogin} className="w-full">
                  {loading ? "Signing in..." : "Sign in"}
                </Button>

                <div className="flex items-center">
                  <Separator className="flex-1" />
                  <span className="px-2 text-xs">OR</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
                  Continue with Google
                </Button>

              </CardContent>

              <CardFooter>
                <p className="text-sm">
                  Don't have an account?{" "}
                  <button className="text-primary" onClick={toggleSignUpMode}>
                    Sign up
                  </button>
                </p>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">

                {formErrors.auth && (
                  <div className="text-red-500 text-sm">{formErrors.auth}</div>
                )}

                <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

                {/* PASSWORD */}
                <div className="relative">
                  <Input
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {/* CONFIRM PASSWORD */}
                <div className="relative">
                  <Input
                    placeholder="Confirm Password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button onClick={handleEmailSignup} className="w-full">
                  Create Account
                </Button>

                <div className="flex items-center">
                  <Separator className="flex-1" />
                  <span className="px-2 text-xs">OR</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
                  Continue with Google
                </Button>

              </CardContent>

              <CardFooter>
                <p className="text-sm">
                  Already have an account?{" "}
                  <button className="text-primary" onClick={toggleSignUpMode}>
                    Sign in
                  </button>
                </p>
              </CardFooter>
            </>
          )}
        </Card>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[350px] space-y-4">

            <h2 className="text-lg font-semibold">Reset Password</h2>

            <Input
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={resetLoading}
            />

            {resetError && (
              <p className="text-sm text-red-600">{resetError}</p>
            )}

            {resetMessage && (
              <p className="text-sm text-green-600">{resetMessage}</p>
            )}

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowForgotModal(false);
                  setResetError("");
                  setResetMessage("");
                }}
                disabled={resetLoading}
              >
                Cancel
              </Button>

              <Button 
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? "Sending..." : "Send Link"}
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}