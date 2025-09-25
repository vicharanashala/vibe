// import { useState, useMemo, useEffect } from "react";
// import { Search, X, CheckCircle, XCircle, Eye, Check } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";
// import { useAuthStore } from "@/store/auth-store";
// import { EmptyState } from "@/components/ui/EmptyState";
// import { Badge } from "@/components/ui/badge";

// // Static user data (replace with actual data fetching if needed)
// const initialUsers = [
//   {
//     id: 1,
//     name: "John Doe",
//     email: "john@example.com",
//     phone: "123-456-7890",
//     address: "123 Main St, Anytown, USA",
//     status: "pending",
//   },
//   {
//     id: 2,
//     name: "Jane Smith",
//     email: "jane@example.com",
//     phone: "987-654-3210",
//     address: "456 Elm St, Othertown, USA",
//     status: "pending",
//   },
//   {
//     id: 3,
//     name: "Alice Johnson",
//     email: "alice@example.com",
//     phone: "555-123-4567",
//     address: "789 Oak St, Somewhere, USA",
//     status: "approved",
//   },
//   // Add more users as needed
// ];

// export default function InviteRequestPage() {
//   const [users, setUsers] = useState(initialUsers);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
//   const [isSearching, setIsSearching] = useState(false);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const { isAuthenticated } = useAuthStore();

//   useEffect(() => {
//     if (searchQuery !== debouncedSearch) {
//       setIsSearching(true);
//     }
//     const handler = setTimeout(() => {
//       setDebouncedSearch(searchQuery);
//       setIsSearching(false);
//     }, 300);

//     return () => {
//       clearTimeout(handler);
//     };
//   }, [searchQuery, debouncedSearch]);

//   const filteredUsers = useMemo(() => {
//     return users.filter((user) =>
//       user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
//       user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
//     );
//   }, [users, debouncedSearch]);

//   const handleApprove = (userId) => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.id === userId ? { ...user, status: "approved" } : user
//       )
//     );
//     console.log(`Approved user ${userId}`);
//   };

//   const handleReject = (userId) => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.id === userId ? { ...user, status: "rejected" } : user
//       )
//     );
//     console.log(`Rejected user ${userId}`);
//   };

//   const handleApproveAll = () => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.status === "pending" ? { ...user, status: "approved" } : user
//       )
//     );
//     console.log("Approved all pending users");
//   };

//   const handleViewDetails = (user) => {
//     setSelectedUser(user);
//   };

//   // Authentication check
//   if (!isAuthenticated) {
//     return (
//       <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
//         <EmptyState
//           title="Authentication Required"
//           description="Please log in to manage registered users."
//           actionText="Go to Login"
//           onAction={() => window.location.href = "/auth"}
//           variant="warning"
//         />
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-1 flex-col gap-8 p-6 pt-0 max-w-7xl mx-auto">
//       <section className="flex flex-col space-y-4">
//         <h1 className="text-4xl font-extrabold tracking-tight text-primary">
//           Registered Users
//         </h1>
//         <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
//           Manage and review all registered users in the system.
//         </p>
//       </section>

//       <Card className="relative bg-gradient-to-br from-background to-primary/5 shadow-lg border-none overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-md"></div>
//         <CardHeader className="relative flex flex-row items-center justify-between">
//           <CardTitle className="text-2xl font-bold">User List</CardTitle>
//           <Button
//             variant="primary"
//             className="bg-green-600 hover:bg-green-700 transition-all duration-300 text-white px-6 py-3 rounded-lg shadow-md flex items-center gap-2"
//             onClick={handleApproveAll}
//           >
//             <Check className="h-5 w-5" />
//             Approve All
//           </Button>
//         </CardHeader>
//         <CardContent className="relative space-y-6">
//           <div className="flex items-center justify-between gap-4">
//             <div className="relative flex-1 max-w-md">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//               <Input
//                 placeholder="Search users by name or email..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="pl-10 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
//               />
//               {searchQuery && (
//                 <X
//                   className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
//                   onClick={() => setSearchQuery("")}
//                 />
//               )}
//             </div>
//           </div>

//           {isSearching ? (
//             <div className="text-center text-muted-foreground">Searching...</div>
//           ) : filteredUsers.length > 0 ? (
//             <Table>
//               <TableHeader>
//                 <TableRow>
//                   <TableHead>Name</TableHead>
//                   <TableHead>Email</TableHead>
//                   <TableHead>Status</TableHead>
//                   <TableHead>Actions</TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {filteredUsers.map((user) => (
//                   <TableRow key={user.id}>
//                     <TableCell>{user.name}</TableCell>
//                     <TableCell>{user.email}</TableCell>
//                     <TableCell>
//                       <Badge
//                         variant={
//                           user.status === "approved"
//                             ? "success"
//                             : user.status === "rejected"
//                             ? "destructive"
//                             : "secondary"
//                         }
//                       >
//                         {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
//                       </Badge>
//                     </TableCell>
//                     <TableCell className="flex gap-2">
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => handleViewDetails(user)}
//                         className="flex items-center gap-1"
//                       >
//                         <Eye className="h-4 w-4" />
//                         View
//                       </Button>
//                       {user.status === "pending" && (
//                         <>
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => handleApprove(user.id)}
//                             className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
//                           >
//                             <CheckCircle className="h-4 w-4" />
//                             Approve
//                           </Button>
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => handleReject(user.id)}
//                             className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
//                           >
//                             <XCircle className="h-4 w-4" />
//                             Reject
//                           </Button>
//                         </>
//                       )}
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           ) : (
//             <EmptyState
//               title="No users found"
//               description="Try adjusting your search or check back later."
//               variant="info"
//             />
//           )}
//         </CardContent>
//       </Card>

//       {/* View Details Modal */}
//       <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
//         <DialogContent className="sm:max-w-md bg-background rounded-lg shadow-xl">
//           <DialogHeader>
//             <DialogTitle className="text-2xl font-bold">User Details</DialogTitle>
//             <p className="text-muted-foreground">Detailed information for {selectedUser?.name}</p>
//           </DialogHeader>
//           {selectedUser && (
//             <div className="space-y-6">
//               <div className="space-y-2">
//                 <Label className="text-sm font-medium">Full Name</Label>
//                 <p className="text-foreground">{selectedUser.name}</p>
//               </div>
//               <div className="space-y-2">
//                 <Label className="text-sm font-medium">Email Address</Label>
//                 <p className="text-foreground">{selectedUser.email}</p>
//               </div>
//               <div className="space-y-2">
//                 <Label className="text-sm font-medium">Phone Number</Label>
//                 <p className="text-foreground">{selectedUser.phone}</p>
//               </div>
//               <div className="space-y-2">
//                 <Label className="text-sm font-medium">Address</Label>
//                 <p className="text-foreground">{selectedUser.address}</p>
//               </div>
//               <div className="space-y-2">
//                 <Label className="text-sm font-medium">Status</Label>
//                 <Badge
//                   variant={
//                     selectedUser.status === "approved"
//                       ? "success"
//                       : selectedUser.status === "rejected"
//                       ? "destructive"
//                       : "secondary"
//                   }
//                 >
//                   {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
//                 </Badge>
//               </div>
//             </div>
//           )}
//           <DialogFooter>
//             <Button
//               variant="primary"
//               onClick={() => setSelectedUser(null)}
//               className="bg-primary hover:bg-primary/90 transition-all duration-300"
//             >
//               Close
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }





// import { useState, useMemo, useEffect } from "react";
// import { Search, X, CheckCircle, XCircle, Eye, CheckSquare } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";
// import { useAuthStore } from "@/store/auth-store";
// import { EmptyState } from "@/components/ui/EmptyState";
// import { Badge } from "@/components/ui/badge";

// // Static user data (replace with actual data fetching if needed)
// const initialUsers = [
//   {
//     id: 1,
//     name: "John Doe",
//     email: "john@example.com",
//     phone: "123-456-7890",
//     address: "123 Main St, Anytown, USA",
//     status: "pending",
//   },
//   {
//     id: 2,
//     name: "Jane Smith",
//     email: "jane@example.com",
//     phone: "987-654-3210",
//     address: "456 Elm St, Othertown, USA",
//     status: "pending",
//   },
//   {
//     id: 3,
//     name: "Alice Johnson",
//     email: "alice@example.com",
//     phone: "555-123-4567",
//     address: "789 Oak St, Somewhere, USA",
//     status: "approved",
//   },
// ];

// export default function RegisteredUsers() {
//   const [users, setUsers] = useState(initialUsers);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
//   const [isSearching, setIsSearching] = useState(false);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const { isAuthenticated } = useAuthStore();

//   useEffect(() => {
//     if (searchQuery !== debouncedSearch) {
//       setIsSearching(true);
//     }
//     const handler = setTimeout(() => {
//       setDebouncedSearch(searchQuery);
//       setIsSearching(false);
//     }, 300);

//     return () => {
//       clearTimeout(handler);
//     };
//   }, [searchQuery, debouncedSearch]);

//   const filteredUsers = useMemo(() => {
//     return users.filter((user) =>
//       user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
//       user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
//     );
//   }, [users, debouncedSearch]);

//   const handleApprove = (userId) => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.id === userId ? { ...user, status: "approved" } : user
//       )
//     );
//     console.log(`Approved user ${userId}`);
//   };

//   const handleReject = (userId) => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.id === userId ? { ...user, status: "rejected" } : user
//       )
//     );
//     console.log(`Rejected user ${userId}`);
//   };

//   const handleApproveAll = () => {
//     setUsers((prevUsers) =>
//       prevUsers.map((user) =>
//         user.status === "pending" ? { ...user, status: "approved" } : user
//       )
//     );
//     console.log("Approved all pending users");
//   };

//   const handleViewDetails = (user) => {
//     setSelectedUser(user);
//   };

//   // Authentication check
//   if (!isAuthenticated) {
//     return (
//       <div className="flex flex-1 flex-col gap-8 p-8 pt-0 max-w-[1400px] mx-auto">
//         <EmptyState
//           title="Authentication Required"
//           description="Please log in to manage registered users."
//           actionText="Go to Login"
//           onAction={() => window.location.href = "/auth"}
//           variant="warning"
//         />
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-1 flex-col gap-8 p-8 pt-0 max-w-[1400px] mx-auto">
//       <section className="flex flex-col space-y-4">
//         <h1 className="text-4xl font-extrabold tracking-tight text-primary">
//           Registered Users
//         </h1>
//         <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
//           Review and manage all users registered for courses with ease.
//         </p>
//       </section>

//       <Card className="relative bg-gradient-to-br from-background to-primary/5 shadow-xl border-none overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-lg"></div>
//         <CardHeader className="relative flex flex-row items-center justify-between py-6">
//           <CardTitle className="text-2xl font-bold">User Management</CardTitle>
//           <Button
//             variant="outline"
//             size="lg"
//             onClick={handleApproveAll}
//             className="flex items-center gap-2 text-green-700 border-green-700 hover:bg-green-50 transition-all duration-300"
//           >
//             <CheckSquare className="h-5 w-5" />
//             Approve All Pending
//           </Button>
//         </CardHeader>
//         <CardContent className="relative space-y-8">
//           <div className="flex items-center justify-start gap-4">
//             <div className="relative w-full max-w-lg">
//               <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
//               <Input
//                 placeholder="Search users by name or email..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="pl-12 py-6 text-base bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 rounded-lg"
//               />
//               {searchQuery && (
//                 <X
//                   className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
//                   onClick={() => setSearchQuery("")}
//                 />
//               )}
//             </div>
//           </div>

//           {isSearching ? (
//             <div className="text-center text-lg text-muted-foreground py-8">
//               Searching users...
//             </div>
//           ) : filteredUsers.length > 0 ? (
//             <Table>
//               <TableHeader>
//                 <TableRow className="border-b border-border/50">
//                   <TableHead className="text-base font-semibold py-4">Name</TableHead>
//                   <TableHead className="text-base font-semibold py-4">Email</TableHead>
//                   <TableHead className="text-base font-semibold py-4">Status</TableHead>
//                   <TableHead className="text-base font-semibold py-4">Actions</TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {filteredUsers.map((user) => (
//                   <TableRow key={user.id} className="hover:bg-muted/50 transition-all duration-200">
//                     <TableCell className="py-4 text-base">{user.name}</TableCell>
//                     <TableCell className="py-4 text-base">{user.email}</TableCell>
//                     <TableCell className="py-4">
//                       <Badge
//                         variant={
//                           user.status === "approved"
//                             ? "success"
//                             : user.status === "rejected"
//                             ? "destructive"
//                             : "secondary"
//                         }
//                         className="text-sm px-3 py-1"
//                       >
//                         {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
//                       </Badge>
//                     </TableCell>
//                     <TableCell className="py-4 flex gap-3">
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => handleViewDetails(user)}
//                         className="flex items-center gap-2 text-primary border-primary/50 hover:bg-primary/10 transition-all duration-300"
//                       >
//                         <Eye className="h-4 w-4" />
//                         View Details
//                       </Button>
//                       {user.status === "pending" && (
//                         <>
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => handleApprove(user.id)}
//                             className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50 transition-all duration-300"
//                           >
//                             <CheckCircle className="h-4 w-4" />
//                             Approve
//                           </Button>
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => handleReject(user.id)}
//                             className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50 transition-all duration-300"
//                           >
//                             <XCircle className="h-4 w-4" />
//                             Reject
//                           </Button>
//                         </>
//                       )}
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           ) : (
//             <EmptyState
//               title="No Users Found"
//               description="No users match your search criteria. Try adjusting your search terms."
//               variant="info"
//               className="py-12"
//             />
//           )}
//         </CardContent>
//       </Card>

//       {/* View Details Modal */}
//       <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
//         <DialogContent className="sm:max-w-lg bg-background rounded-lg shadow-2xl">
//           <DialogHeader className="pb-6">
//             <DialogTitle className="text-2xl font-bold">User Details</DialogTitle>
//             <p className="text-lg text-muted-foreground">
//               Detailed information for {selectedUser?.name}
//             </p>
//           </DialogHeader>
//           {selectedUser && (
//             <div className="space-y-6">
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-foreground/80">Full Name</Label>
//                 <p className="text-base text-foreground">{selectedUser.name}</p>
//               </div>
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-foreground/80">Email Address</Label>
//                 <p className="text-base text-foreground">{selectedUser.email}</p>
//               </div>
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-foreground/80">Phone Number</Label>
//                 <p className="text-base text-foreground">{selectedUser.phone}</p>
//               </div>
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-foreground/80">Address</Label>
//                 <p className="text-base text-foreground">{selectedUser.address}</p>
//               </div>
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-foreground/80">Status</Label>
//                 <Badge
//                   variant={
//                     selectedUser.status === "approved"
//                       ? "success"
//                       : selectedUser.status === "rejected"
//                       ? "destructive"
//                       : "secondary"
//                   }
//                   className="text-sm px-3 py-1"
//                 >
//                   {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
//                 </Badge>
//               </div>
//             </div>
//           )}
//           <DialogFooter className="pt-8">
//             <Button
//               variant="primary"
//               size="lg"
//               onClick={() => setSelectedUser(null)}
//               className="bg-primary hover:bg-primary/90 transition-all duration-300 px-6"
//             >
//               Close
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }








import { useState, useMemo, useEffect } from "react";
import { Search, X, CheckCircle, XCircle, Eye, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";

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
          Registered Users
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
            <Button
              variant="outline"
              size="lg"
              onClick={handleApproveAll}
              className="flex items-center gap-2 text-green-700 border-green-700 hover:bg-green-50 transition-all duration-300 ml-4"
            >
              <CheckSquare className="h-5 w-5" />
              Approve All
            </Button>
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
                    <TableHead className="text-lg font-semibold py-6 w-1/4">Name</TableHead>
                    <TableHead className="text-lg font-semibold py-6 w-1/3">Email</TableHead>
                    <TableHead className="text-lg font-semibold py-6 w-1/6">Status</TableHead>
                    <TableHead className="text-lg font-semibold py-6 w-1/4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50 transition-all duration-200">
                      <TableCell className="py-6 text-lg font-medium">{user.name}</TableCell>
                      <TableCell className="py-6 text-base">{user.email}</TableCell>
                      <TableCell className="py-6">
                        <Badge
                          variant={
                            user.status === "approved"
                              ? "success"
                              : user.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-base px-4 py-2"
                        >
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 flex gap-3">
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
                <Badge
                  variant={
                    selectedUser.status === "approved"
                      ? "success"
                      : selectedUser.status === "rejected"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-base px-4 py-2"
                >
                  {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                </Badge>
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