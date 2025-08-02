import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

const MobileFallbackScreen = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center p-6">
      <div className="bg-gray-100 rounded-full p-4 mb-6">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-16 w-16 text-red-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
      
      <h1 className="text-3xl font-bold text-gray-800 mb-3">
        Access Restricted
      </h1>
      
      <p className="text-lg text-gray-600 max-w-md mb-8">
        The student portal requires a laptop or desktop computer for full functionality. 
        Please switch devices to access your learning resources.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          className="px-8 py-5 text-base"
          onClick={() => navigate({ to: '/auth' })}
        >
          Return to Home
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="px-8 py-5 text-base"
          onClick={() => window.location.reload()}
        >
          Check Again
        </Button>
      </div>
      
      <p className="mt-10 text-gray-500 text-sm max-w-md">
        If you believe this is a mistake, please contact the officials for further assistance.
      </p>
    </div>
  );
};

export default MobileFallbackScreen;