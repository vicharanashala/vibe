import { useCourseVersionById, useInvites } from "@/hooks/hooks"
import { useEffect, useState } from "react";
import InviteItem from "./InviteItem";


const InviteDropdown = () => {
    const { getInvites, loading, error } = useInvites();
    const [invites, setInvites] = useState([]);

    useEffect(() => {
        const getUserInvites = async () => {
            const result = await getInvites();
            console.log(result);
            setInvites(result.invites);
        }
        getUserInvites();
    }, [])

    return (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-black rounded-xl shadow-lg border border-red-100 dark:border-zinc-700 z-50" >
            <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-60 overflow-auto p-2">
                {loading ? (
                    <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">Loading...</li>
                ) : (() => {
                    const pendingInvites = invites.filter((invite) => (invite.inviteStatus === "PENDING"));

                    return pendingInvites.length === 0 ? (
                        <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">No Pending Invites</li>
                    ) : (
                        pendingInvites.map((invite, idx) => (
                            <InviteItem key={idx} invite={invite} />
                        ))
                    );
                })()}
            </ul>
        </div>
    )
}

export default InviteDropdown