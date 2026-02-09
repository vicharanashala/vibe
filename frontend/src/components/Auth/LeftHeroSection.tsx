
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card} from "@/components/ui/card";
import { ShineBorder } from "@/components/magicui/shine-border";
import { AuroraText } from "@/components/magicui/aurora-text";
import collabration from "../../../public/img/collabration.svg";
import vledLogo from "../../../public/img/vled-logo-login.png";

export const LeftHeroSection =()=>{
    const navigate = useNavigate();
  return(
    <>
     {/* Left Side - Hero Section with Logos - Mobile & Desktop */}
        <div className="flex flex-col justify-center items-center p-6 lg:p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative lg:flex-1 min-h-[40vh] lg:min-h-screen">

          {/* Top Section with Brand - Positioned Absolutely */}
          <div className="absolute top-8 left-8 flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:!bg-[#C393E2] "
              onClick={() => navigate({ to: "/auth" })}
            >
              ← Back
            </Button>
            <div className="h-12 w-12 rounded-lg overflow-hidden">
              <img
                src={collabration}
                alt="Vibe Logo"
                className="h-12 w-12 object-contain"
              />
            </div>

            <span className="text-3xl font-bold">
              <AuroraText colors={["#A07CFE", "#FE8FB5", "#FFBE7B"]}><b>ViBe</b></AuroraText>
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
                 Funded by
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
                      src="https://res.cloudinary.com/dgwhmqdhr/image/upload/v1769143826/annam-color-with-icon_jsaz3l.png"
                      alt="Annam Logo"
                      style={{  transform: 'translateY(5px)' }}
                      className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </Card>

                <Card className="relative overflow-visible bg-white backdrop-blur-sm border-2 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                  <ShineBorder
                    shineColor={["#A07CFE", "#FFBE7B", "#FE8FB5"]}
                    className="absolute inset-0"
                  />
                  <div className="relative p-4 flex items-center justify-center h-28 bg-white/95">
                    <img
                      src={vledLogo}
                      alt="VLED Logo"
                      style={{ transform: 'scale(1)' }}
                      className="h-20 w-auto object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
    </>
  )
}