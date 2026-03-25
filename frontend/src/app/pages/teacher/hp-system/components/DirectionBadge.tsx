import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function DirectionBadge({ direction }: { direction: string }) {
    if (direction === 'CREDIT') {
        return (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Credit
            </Badge>
        );
    }
    if (direction === 'DEBIT') {
        return (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
                <AlertCircle className="h-3 w-3" /> Debit
            </Badge>
        );
    }
    return <Badge variant="secondary">{direction}</Badge>;
}