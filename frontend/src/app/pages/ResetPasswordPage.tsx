import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/utils/utils";
import {
  verifyResetCode,
  resetPassword,
} from "@/lib/firebase";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { ShineBorder } from "@/components/magicui/shine-border";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });

  const oobCode = search.oobCode as string | undefined;

  const [email, setEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔐 Verify reset link on load
  useEffect(() => {
    // TODO: Set the firebase email template with format "frontend_url/reset-password?&mode=resetPassword&oobCode=jhaskdhdhu"
    if (!oobCode) {
  // Firebase already completed the reset
  setSuccess(true);
  return;
}


    const verify = async () => {
      try {
        const result = await verifyResetCode(oobCode);
        if (!result.valid) {
          setError(result.message ?? "Invalid or expired reset link.");
          return;
        }
        setEmail(result.email);
      } catch {
        setError("Invalid or expired reset link.");
      }
    };

    verify();
  }, [oobCode]);

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await resetPassword(oobCode!, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Success UI
  if (success) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          repeatDelay={1}
          className={cn(
            "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
            "absolute inset-0 h-full w-full"
          )}
        />

        <div className="relative z-10 w-full max-w-md px-4">
          <Card className="relative overflow-hidden">
            <ShineBorder
              shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
              duration={8}
              borderWidth={2}
            />

            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">
                Password Reset Successful
              </CardTitle>
              <CardDescription className="pt-2">
                You can now sign in with your new password.
              </CardDescription>
            </CardHeader>

            <CardFooter>
              <Button
                className="w-full"
                onClick={() => navigate({ to: "/login" })}
              >
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // ❌ Invalid link
  if (error && !email) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <CardTitle className="text-xl pt-2">
              Invalid Reset Link
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => navigate({ to: "/forgot-password" })}
            >
              Request New Link
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 🔑 Reset form
  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.1}
        duration={3}
        repeatDelay={1}
        className={cn(
          "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
          "absolute inset-0 h-full w-full"
        )}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="relative overflow-hidden">
          <ShineBorder
            shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
            duration={8}
            borderWidth={2}
          />

          <CardHeader className="text-center">
            <Lock className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-2xl pt-2">
              Reset Your Password
            </CardTitle>
            <CardDescription>
              {email && <>For <strong>{email}</strong></>}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              {/* <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div> */}
              {/* Password Field */}
                                      <div className="space-y-2">
                                        <Label htmlFor="password" className="text-sm font-medium">
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
                                            error && "border-destructive focus-visible:ring-destructive"
                                          )}
                                          />
                                         <Button variant="ghost" size="icon" aria-label="" className="absolute inset-y-0 right-1" onClick={() => setShowPassword(p => !p)}>
                                          {showPassword? <EyeOff />:<Eye />}
                                          </Button> 
                                          </div>
                                      
                                      </div>
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
                        

                        {/* Confirm Password */}
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword" className="text-sm font-medium">
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
                            {showPassword? <EyeOff />:<Eye />}
                            </Button> 
                          </div>
                          {!passwordsMatch && confirmPassword && (
                            <p className="text-xs text-destructive">Passwords do not match</p>
                          )}
                        </div>


              <Button
                type="submit"
                className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80"
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
