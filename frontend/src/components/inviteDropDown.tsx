import { useInvites } from "@/hooks/hooks";
import {  useState } from "react";
import InviteItem from "./InviteItem";

type InviteDropdownProps = {
  pendingInvites: any[];
  setPendingInvites: React.Dispatch<React.SetStateAction<any[]>>;
};

const InviteDropdown = ({ pendingInvites, setPendingInvites }: InviteDropdownProps) => {
  const { getInvites, loading, error } = useInvites();
  const [invites, setInvites] = useState<any[]>(pendingInvites || []);

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-black rounded-xl shadow-lg border border-red-100 dark:border-zinc-700 z-50">
      <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-60 overflow-auto p-2">
        {loading ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            Loading...
          </li>
        ) : invites.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            No Pending Invites
          </li>
        ) : (
          invites.map((invite: any, idx: number) => (
            <InviteItem key={idx} invite={invite} />
          ))
        )}
      </ul>
    </div>
  );
};

export default InviteDropdown;
