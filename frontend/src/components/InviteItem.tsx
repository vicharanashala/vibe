import { useProcessInvites } from "@/hooks/hooks";
import { useState } from "react";
import { Button } from "./ui/button";

const InviteItem = ({ invite }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [status, setStatus] = useState(invite.inviteStatus); // track local status

    const onAccept = async (invite) => {
        const { data, isLoading, error } = await useProcessInvites(invite.inviteId);
        if (!isLoading && !error) {
            setStatus("ACCEPTED");
            setIsExpanded(false);
            window.location.reload();
        }
    };

    const handleToggle = () => {
        if (status !== "ACCEPTED") {
            setIsExpanded((prev) => !prev);
        }
    };

    return (
        <li
            className={`flex flex-col ${status !== "ACCEPTED" ? "cursor-pointer" : ""
                } px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-red-100 dark:hover:bg-zinc-700 rounded transition-all`}
            onClick={handleToggle}
        >
            <span className="font-medium">{invite.course.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
                Status:{" "}
                <span
                    className={
                        status === "PENDING"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-gray-600 dark:text-gray-300"
                    }
                >
                    {status}
                </span>
            </span>

            {isExpanded && status === "PENDING" && (
                <div className="mt-2">
                    <Button
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAccept(invite);
                        }}
                        className="relative right-0 mt-1 text-sm cursor-pointer font-medium text-green-600 dark:text-green-400"
                    >
                        Accept
                    </Button>
                </div>
            )}
        </li>
    );
};

export default InviteItem;
