import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { cn } from "@/utils/utils";
import { LeftHeroSection } from "@/components/Auth/LeftHeroSection";


const SelectRolePage = () => {
    const navigate = useNavigate()
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
            <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-md space-y-8">
                    {/* Role Selection */}
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-bold tracking-tight">
                            Welcome to Vibe
                        </h2>
                        <p className="text-muted-foreground">
                            Choose how you want to continue
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            onClick={() => {
                                navigate({ to: '/student/login' })
                            }}
                            className="w-full h-14 text-lg"
                            variant="outline"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-primary">
                                    <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4Zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" fill="currentColor" />
                                </svg>
                               Join to Learn
                            </span>
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or
                                </span>
                            </div>
                        </div>

                        <Button
                            onClick={() => {
                                navigate({ to: '/teacher/login' })
                            }}
                            className="w-full h-14 text-lg"
                            variant="outline"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-primary">
                                    <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4Zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6-2V7a6 6 0 1 0-12 0v1a2 2 0 0 0-2 2v2h16V9a2 2 0 0 0-2-2Z" fill="currentColor" />
                                </svg>
                               Join to Teach
                            </span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        </div>
    )
}

export default SelectRolePage
