import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<
    string,
    { label: string; variant: "outline"; icon: typeof CheckCircle; className: string }
> = {
    SUBMITTED: { label: "Submitted", variant: "outline", icon: Clock, className: "text-sm font-semibold text-yellow-600" },
    PENDING: { label: "Pending", variant: "outline", icon: Clock, className: "text-sm font-semibold text-yellow-600" },
    APPROVED: { label: "Approved", variant: "outline", icon: CheckCircle, className: "text-sm font-semibold text-green-600" },
    GRADED: { label: "Approved", variant: "outline", icon: CheckCircle, className: "text-sm font-semibold text-green-600" },
    REJECTED: { label: "Rejected", variant: "outline", icon: XCircle, className: "text-sm font-semibold text-red-600" },
    REVERTED: { label: "Reverted", variant: "outline", icon: XCircle, className: "text-sm font-semibold text-red-600" },

};

export function SubmissionStatusBadge({ status, className, rule }: { status: string; className?: string; rule?: string }) {

    console.log("Component statuBadge ,", status, className, rule)
    const cfg = STATUS_CONFIG[status] || {
        label: status,
        variant: "outline" as const,
        icon: Clock,
        className: "text-sm font-semibold text-muted-foreground",
    };
    const StatusIcon = cfg.icon;

    if(rule === "ON_APPROVAL" && status === "SUBMITTED"){
        return <Badge variant={"outline"} className="flex items-center gap-1 text-lg font-semibold text-yellow-600">
            <Clock className="h-3 w-3 mr-1"/>
            In Review
        </Badge>
    }

    return (
        <Badge variant={cfg.variant} className={`flex items-center gap-1 ${cfg.className} ${className ?? ""}`.trim()}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {cfg.label}
        </Badge>
    );
}
