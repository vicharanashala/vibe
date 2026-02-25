import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useAnnouncements, useDeleteAnnouncement, useToggleHideAnnouncement } from "@/hooks/announcement-hooks";
import { AnnouncementItem } from "./AnnouncementItem";
import { AnnouncementModal } from "./AnnouncementModal";
import { Announcement, AnnouncementType } from "@/types/announcement.types";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Loader2, Megaphone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface AnnouncementListProps {
    courseId?: string;
    versionId?: string;
    isInstructor?: boolean;
}

export function AnnouncementList({ courseId, versionId, isInstructor }: AnnouncementListProps) {
    const { user } = useAuthStore();
    const { data, isLoading, refetch } = useAnnouncements(
        undefined, // fetch all initially, filter locally or let hook handle
        courseId,
        versionId,
        !isInstructor // student mode if not instructor
    );

    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<AnnouncementType | 'ALL'>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Announcement | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Decide default type for creation based on context
    const defaultCreateType = versionId ? AnnouncementType.VERSION_SPECIFIC : courseId ? AnnouncementType.COURSE_SPECIFIC : AnnouncementType.GENERAL;

    const filteredData = data.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
            item.content.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'ALL' || item.type === filterType;

        return matchesSearch && matchesType;
    });

    const handleEdit = (item: Announcement) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const { mutateAsync: deleteAnnouncement } = useDeleteAnnouncement();
    const { mutateAsync: toggleHideAnnouncement } = useToggleHideAnnouncement();

    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteAnnouncement(deleteId);
            refetch();
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search announcements..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Filter className="h-4 w-4" />
                                Filter: {filterType === 'ALL' ? 'All Types' : filterType.replace('_', ' ')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuCheckboxItem checked={filterType === 'ALL'} onCheckedChange={() => setFilterType('ALL')}>
                                All Types
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterType === AnnouncementType.GENERAL} onCheckedChange={() => setFilterType(AnnouncementType.GENERAL)}>
                                General
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterType === AnnouncementType.COURSE_SPECIFIC} onCheckedChange={() => setFilterType(AnnouncementType.COURSE_SPECIFIC)}>
                                Course Specific
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterType === AnnouncementType.VERSION_SPECIFIC} onCheckedChange={() => setFilterType(AnnouncementType.VERSION_SPECIFIC)}>
                                Version Specific
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {isInstructor && (
                        <Button size="sm" className="gap-2" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                            <Plus className="h-4 w-4" />
                            New Announcement
                        </Button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredData.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                    <Megaphone className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-muted-foreground">No announcements found</h3>
                    <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto mt-1">
                        {search ? "Try adjusting your search filters" : "There are no announcements to display at this time."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredData.map(item => (
                        <AnnouncementItem
                            key={item._id}
                            announcement={item}
                            isInstructor={isInstructor}
                            currentUserId={user?.uid}
                            isAdmin={user?.role === 'admin'}
                            onEdit={handleEdit}
                            onDelete={(id) => setDeleteId(id)}
                            onToggleHide={(id) => {
                                toggleHideAnnouncement(id).then(() => refetch());
                            }}
                        />
                    ))}
                </div>
            )}

            {isInstructor && (
                <AnnouncementModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); refetch(); }}
                    initialData={editingItem}
                    defaultType={defaultCreateType}
                    courseId={courseId}
                    versionId={versionId}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Announcement</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this announcement? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
