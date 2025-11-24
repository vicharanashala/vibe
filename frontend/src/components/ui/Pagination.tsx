import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationProps } from "@/types/ui.types";

export const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalDocuments, 
  onPageChange, 
  className 
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  // Page number generation which shows: 1 ... two middle pages ... last
  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages: (number | string)[] = [1];
    
    // Calculate the two middle pages to show
    const middlePages = [];
    
    if (currentPage > 2 && currentPage < totalPages - 1) {
      // Show current page and next page
      middlePages.push(currentPage, currentPage + 1);
    } else if (currentPage === 2) {
      // Show pages 2 and 3
      middlePages.push(2, 3);
    } else if (currentPage === totalPages - 1) {
      // Show pages totalPages-2 and totalPages-1
      middlePages.push(totalPages - 2, totalPages - 1);
    } else {
      // Default fallback
      middlePages.push(2, 3);
    }
    
    // Add first ellipsis if needed
    if (middlePages[0]! > 2) {
      pages.push('...');
    }
    
    // Add the two middle pages
    pages.push(...middlePages);
    
    // Add second ellipsis if needed
    if (middlePages[1]! < totalPages - 1) {
      pages.push('...');
    }
    
    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
  <div className={`flex flex-col items-center gap-4 mt-6 ${className || ''}`}>
    {/* Page info - always on its own line */}
    <p className="text-sm text-muted-foreground text-center whitespace-nowrap">
      Page {currentPage} of {totalPages} • {totalDocuments} total
    </p>
    
    {/* Pagination buttons - always on its own line */}
    <div className="relative w-full max-w-max">
      {/* Gradient fade effects on mobile */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
      
      {/* Pagination buttons container */}
      <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto w-full justify-center py-2 px-4">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-2 sm:px-3 flex-shrink-0"
        >
          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline ml-1">Previous</span>
        </Button>
        
        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {visiblePages.map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <MoreHorizontal 
                  key={`ellipsis-${index}`} 
                  className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" 
                />
              );
            }
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum as number)}
                className="h-8 w-8 p-0 text-xs sm:text-sm sm:w-10 sm:px-3 flex-shrink-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-2 sm:px-3 flex-shrink-0"
        >
          <span className="hidden xs:inline mr-1">Next</span>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  </div>
);};