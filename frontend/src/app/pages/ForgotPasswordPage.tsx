import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, Mail } from "lucide-react";
import { cn } from "@/utils/utils";
import { useNavigate } from "@tanstack/react-router";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { ShineBorder } from "@/components/magicui/shine-border";
import ReCAPTCHA from "react-google-recaptcha";
import { useRef } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRecaptchaEnabled: boolean = import.meta.env.VITE_IS_RECAPTCHA_ENABLED === "true";
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isRecaptchaEnabled && !recaptchaToken) {
        setError("Please complete the reCAPTCHA verification");
        return;
      }

      const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/forgot-password`;
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recaptchaToken: isRecaptchaEnabled ? recaptchaToken : "NO_CAPTCHA",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Failed to request reset email");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isRecaptchaEnabled && !recaptchaToken) {
        setError("Please complete the reCAPTCHA verification to resend");
        return;
      }

      const backendUrl = `${import.meta.env.VITE_BASE_URL}/auth/resend-forgot-password`;
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recaptchaToken: isRecaptchaEnabled ? recaptchaToken : "NO_CAPTCHA",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Failed to resend reset email");
      }

      toast.success("Password reset email resent successfully!");
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend reset email");
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

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
            "absolute inset-0 h-full w-full",
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
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription className="pt-2">
                We've sent a password reset link to
                <br />
                <strong className="text-foreground">{email}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg border border-muted bg-muted/10 p-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">What's next?</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Check your email inbox</li>
                      <li>Click the reset link</li>
                      <li>Create a new password</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              {isRecaptchaEnabled && (
                <div className="flex justify-center scale-[0.95] origin-bottom mb-4">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                    theme="dark"
                    onChange={(token) => {
                      setRecaptchaToken(token);
                      if (error) setError(null);
                    }}
                    onExpired={() => setRecaptchaToken(null)}
                    onErrored={() => {
                      setRecaptchaToken(null);
                      setError("reCAPTCHA error. Please try again.");
                    }}
                  />
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleResend}
                disabled={loading || (isRecaptchaEnabled && !recaptchaToken)}
              >
                {loading ? "Resending..." : "Resend Email"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: "/auth" })}
              >
                Back to Login
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                  setError(null);
                  setRecaptchaToken(null);
                }}
              >
                Try Another Email
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
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
      
      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="relative overflow-hidden">
          <ShineBorder
            shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
            duration={8}
            borderWidth={2}
          />
          
          <CardHeader>
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-4 left-4 text-muted-foreground"
              onClick={() => navigate({ to: "/auth" })}
            >
              ← Back
            </Button>
            <CardTitle className="text-2xl text-center pt-8">Forgot Password?</CardTitle>
            <CardDescription className="text-center pt-2">
              Enter your email and we'll send you a link to reset your password
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

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "transition-all duration-200",
                    error && "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={loading}
                />
              </div>

              {isRecaptchaEnabled && (
                <div className="flex justify-center scale-[0.95] origin-left">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                    theme="dark"
                    onChange={(token) => {
                      setRecaptchaToken(token);
                      if (error) setError(null);
                    }}
                    onExpired={() => setRecaptchaToken(null)}
                    onErrored={() => {
                      setRecaptchaToken(null);
                      setError("reCAPTCHA error. Please try again.");
                    }}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary/80"
                disabled={loading || (isRecaptchaEnabled && !recaptchaToken)}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </CardContent>
          </form>

          <CardFooter>
            <p className="w-full text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-medium"
                onClick={() => navigate({ to: "/auth" })}
              >
                Sign in
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}