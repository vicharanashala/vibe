import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ViolationMetadata } from "@/types/reportanomaly.types";
import { Info } from "lucide-react";

interface ViolationExplanationBadgeProps {
  metadata?: ViolationMetadata;
}

export const ViolationExplanationBadge: React.FC<ViolationExplanationBadgeProps> = ({ metadata }) => {
  if (!metadata || !metadata.reason) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const confidence = metadata.signalStrength ?? 1.0;
  
  // Calculate severity color
  let badgeColor = "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
  let severityLabel = "Low Confidence";

  if (confidence >= 0.85) {
    badgeColor = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
    severityLabel = "High Confidence";
  } else if (confidence >= 0.5) {
    badgeColor = "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100";
    severityLabel = "Medium Confidence";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-1.5 cursor-pointer max-w-fit">
            <Badge variant="outline" className={`${badgeColor} px-2 py-0.5 text-xs font-medium rounded-full`}>
              {severityLabel}
            </Badge>
            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-3 max-w-xs space-y-2 bg-popover text-popover-foreground border shadow-md">
          <p className="font-semibold text-xs text-foreground">Explainable Log Details</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {metadata.reason}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1.5 border-t text-[11px]">
            {metadata.durationMs !== undefined && (
              <>
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{(metadata.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
            {metadata.consecutiveFrames !== undefined && (
              <>
                <span className="text-muted-foreground">Frames:</span>
                <span className="font-medium">{metadata.consecutiveFrames} frames</span>
              </>
            )}
            {metadata.signalStrength !== undefined && (
              <>
                <span className="text-muted-foreground">Signal Strength:</span>
                <span className="font-medium">{(metadata.signalStrength * 100).toFixed(0)}%</span>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
