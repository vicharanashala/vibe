import { useState, useMemo, useEffect } from "react";
import { Search, X, CheckCircle, XCircle, Eye, CheckSquare, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/store/auth-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Static user data (replace with actual data fetching if needed)
const initialUsers = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    phone: "123-456-7890",
    address: "123 Main St, Anytown, USA",
    status: "pending",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "987-654-3210",
    address: "456 Elm St, Othertown, USA",
    status: "pending",
  },
  {
    id: 3,
    name: "Alice Johnson",
    email: "alice@example.com",
    phone: "555-123-4567",
    address: "789 Oak St, Somewhere, USA",
    status: "approved",
  },
];

export default function RegisteredUsers() {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
    }
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debouncedSearch]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) =>
      user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [users, debouncedSearch]);

  const handleCheckboxChange = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleApproveSelected = () => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        selectedUserIds.includes(user.id)
          ? { ...user, status: "approved" }
          : user
      )
    );
    setSelectedUserIds([]);
    console.log("Approved selected users:", selectedUserIds);
  };

  const handleApprove = (userId) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, status: "approved" } : user
      )
    );
    console.log(`Approved user ${userId}`);
  };

  const handleReject = (userId) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, status: "rejected" } : user
      )
    );
    console.log(`Rejected user ${userId}`);
  };

  const handleApproveAll = () => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.status === "pending" ? { ...user, status: "approved" } : user
      )
    );
    setSelectedUserIds([]);
    console.log("Approved all pending users");
  };

  const handleViewDetails = (user) => {
    setSelectedUser(user);
  };

  // Authentication check
  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-8 pt-0 w-full">
        <EmptyState
          title="Authentication Required"
          description="Please log in to manage registered users."
          actionText="Go to Login"
          onAction={() => window.location.href = "/auth"}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-0 w-full">
      <section className="flex flex-col space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          Course Registration Requests
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">
          Review and manage all users registered for courses with ease.
        </p>
      </section>

      <Card className="relative bg-gradient-to-br from-background to-primary/5 shadow-xl border-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-lg"></div>
        <CardHeader className="relative px-8 py-6">
          <div className="flex items-center justify-between w-full">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-6 text-base bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 rounded-lg"
              />
              {searchQuery && (
                <X
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
                  onClick={() => setSearchQuery("")}
                />
              )}
            </div>
            <div className="flex items-center gap-4">
              {selectedUserIds.length > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleApproveSelected}
                  className="flex items-center gap-2 text-green-700 border-green-700 hover:bg-green-50 transition-all duration-300"
                >
                  <CheckCircle className="h-5 w-5" />
                  Approve Selected
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={handleApproveAll}
                className="flex items-center gap-2 text-green-700 border-green-700 hover:bg-green-50 transition-all duration-300"
              >
                <CheckSquare className="h-5 w-5" />
                Approve All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative px-8 pb-8 space-y-0">
          {isSearching ? (
            <div className="text-center text-lg text-muted-foreground py-12">
              Searching users...
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50">
                    <TableHead className="w-12 py-4"></TableHead>
                    <TableHead className="text-lg font-semibold py-4 w-1/4">Name</TableHead>
                    <TableHead className="text-lg font-semibold py-4 w-1/3">Email</TableHead>
                    <TableHead className="text-lg font-semibold py-4 w-1/6">Status</TableHead>
                    <TableHead className="text-lg font-semibold py-4 w-1/4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50 transition-all duration-200">
                      <TableCell className="py-4">
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => handleCheckboxChange(user.id)}
                          disabled={user.status !== "pending"}
                          className="h-5 w-5 border-white bg-white text-green-700"
                        />
                      </TableCell>
                      <TableCell className="py-4 text-lg font-medium">{user.name}</TableCell>
                      <TableCell className="py-4 text-base">{user.email}</TableCell>
                      <TableCell className="py-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {user.status === "approved" ? (
                                <CheckCircle className="h-6 w-6 text-green-600" />
                              ) : user.status === "rejected" ? (
                                <XCircle className="h-6 w-6 text-red-600" />
                              ) : (
                                <Hourglass className="h-6 w-6 text-yellow-600" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-4 flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(user)}
                          className="flex items-center gap-2 text-primary border-primary/50 hover:bg-primary/10 transition-all duration-300 px-4 py-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                        {user.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(user.id)}
                              className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50 transition-all duration-300 px-4 py-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(user.id)}
                              className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50 transition-all duration-300 px-4 py-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="No Users Found"
              description="No users match your search criteria. Try adjusting your search terms."
              variant="info"
              className="py-16"
            />
          )}
        </CardContent>
      </Card>

      {/* View Details Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-xl bg-background rounded-lg shadow-2xl">
          <DialogHeader className="pb-8">
            <DialogTitle className="text-2xl font-bold">User Details</DialogTitle>
            <p className="text-lg text-muted-foreground">
              Detailed information for {selectedUser?.name}
            </p>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="text-base font-medium text-foreground/80">Full Name</Label>
                <p className="text-lg text-foreground">{selectedUser.name}</p>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-medium text-foreground/80">Email Address</Label>
                <p className="text-lg text-foreground">{selectedUser.email}</p>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-medium text-foreground/80">Phone Number</Label>
                <p className="text-lg text-foreground">{selectedUser.phone}</p>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-medium text-foreground/80">Address</Label>
                <p className="text-lg text-foreground">{selectedUser.address}</p>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-medium text-foreground/80">Status</Label>
                <div className="flex items-center gap-2">
                  {selectedUser.status === "approved" ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : selectedUser.status === "rejected" ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <Hourglass className="h-6 w-6 text-yellow-600" />
                  )}
                  <span className="text-base text-foreground">
                    {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setSelectedUser(null)}
              className="bg-primary hover:bg-primary/90 transition-all duration-300 px-8 py-3"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
