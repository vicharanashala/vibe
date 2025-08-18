import { type FC, useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useNavigate } from "@tanstack/react-router"

export const NotFoundComponent: FC = () => {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(5)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const getHomeRoute = () => {
    if (isAuthenticated && user?.role) {
      return `/${user.role.toLowerCase()}`
    }
    return "/auth"
  }

  const handleRedirect = () => {
    setIsRedirecting(true)
    setTimeout(() => {
      navigate({ to: getHomeRoute() })
    }, 300)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRedirect()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const progressPercentage = ((5 - countdown) / 5) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 bg-gray-50/50 dark:bg-orange-950/70 flex items-center justify-center p-4">
      <div className="text-center p-8 bg-white/90 dark:bg-[#1a0a14]/90 backdrop-blur-sm rounded-2xl shadow-xl max-w-md border border-[#ffecb3]/30 dark:border-[#ff9408]/30 transform transition-all duration-300 hover:shadow-2xl">
        <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-r from-[#ffecb3] to-[#ff9eb3] dark:from-[#95122c80] dark:to-[#ff940880] rounded-full flex items-center justify-center shadow-inner animate-pulse">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-amber-800 dark:text-amber-100 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping"></div>
            <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping delay-75"></div>
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-amber-100 mb-2 animate-fade-in">
            4<span className="inline-block animate-bounce delay-100">0</span>4
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-amber-200 animate-fade-in delay-200">
            Page Not Found
          </h2>
        </div>

        <p className="text-gray-600 dark:text-amber-200/80 mb-6 animate-fade-in delay-300">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {isAuthenticated && user?.role && (
          <div className="mb-6 p-4 bg-gradient-to-r from-[#ffecb3]/30 to-[#ff9eb3]/30 dark:from-[#95122c40] dark:to-[#ff940840] rounded-lg border border-[#ffecb3]/50 dark:border-[#ff9408]/50 animate-fade-in delay-400">
            <div className="flex items-center justify-center mb-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent mr-2"></div>
              <p className="text-amber-800 dark:text-amber-100 font-medium">
                Redirecting to your {user.role.toLowerCase()} dashboard...
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-200 tabular-nums">{countdown}</span>
              <span className="text-amber-600 dark:text-amber-300 text-sm">
                second{countdown !== 1 ? "s" : ""} remaining
              </span>
            </div>

            <div className="w-full bg-amber-200/50 dark:bg-amber-900/50 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          onClick={handleRedirect}
          disabled={isRedirecting}
          className={`
            border bg-gradient-to-r from-[#ffecb3] to-[#ff9eb3] 
            dark:bg-gradient-to-r dark:to-[#ff940880] dark:from-[#95122c80] 
            dark:text-white text-black shadow-lg rounded-2xl 
            flex items-center justify-center p-4 gap-2 w-full h-[60px] 
            transform transition-all duration-300 
            ${
              isRedirecting
                ? "scale-95 opacity-75 cursor-not-allowed"
                : "hover:scale-105 hover:shadow-xl active:scale-95"
            }
            animate-fade-in delay-500
          `}
        >
          {isRedirecting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
              Redirecting...
            </>
          ) : (
            <>
              {isAuthenticated && user?.role
                ? `Go to ${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard`
                : "Return to Login"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 transition-transform group-hover:translate-x-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </>
          )}
        </button>

        {/* Additional Actions */}
        <div className="mt-6 space-y-3 animate-fade-in delay-700">
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => window.history.back()}
              className="text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors duration-200 text-sm font-medium flex items-center space-x-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Go Back</span>
            </button>

            <button
              onClick={() => (window.location.href = "/")}
              className="text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors duration-200 text-sm font-medium flex items-center space-x-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>Home</span>
            </button>
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="mt-6 pt-4 border-t border-[#ffecb3]/20 dark:border-[#ff9408]/20 animate-fade-in delay-1000">
          <div className="flex items-center justify-center space-x-4 text-sm text-amber-700 dark:text-amber-300/70">
            <span className="flex items-center space-x-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Error code: 404</span>
            </span>
            <span className="text-amber-600 dark:text-amber-400">•</span>
            <span>Page not found</span>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-[#ffecb3]/10 to-[#ff9eb3]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-gradient-to-r from-[#ff9eb3]/10 to-[#ffecb3]/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
    </div>
  )
}
