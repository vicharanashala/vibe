import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Eye, User, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CourseRegistrationRequests() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([
    {
      _id: 'reg001',
      detail: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        mobile: '+91-9876543210',
        gender: 'Male',
        city: 'Bengaluru',
        state: 'Karnataka',
        category: 'General',
        university: 'ABC University',
      },
      status: 'pending',
      createdAt: '2025-09-26T10:30:00.000Z',
    },
    {
      _id: 'reg002',
      detail: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        mobile: '+91-9123456780',
        gender: 'Female',
        city: 'Hyderabad',
        state: 'Telangana',
        category: 'OBC',
        university: 'XYZ University',
      },
      status: 'approved',
      createdAt: '2025-09-25T15:00:00.000Z',
    },
    {
      _id: 'reg003',
      detail: {
        name: 'Arjun Kumar',
        email: 'arjun.kumar@example.com',
        mobile: '+91-9988776655',
        gender: 'Male',
        city: 'Chennai',
        state: 'Tamil Nadu',
        category: 'SC',
        university: 'LMN College',
      },
      status: 'pending',
      createdAt: '2025-09-24T12:15:00.000Z',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(item => item !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(registrations.map(r => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleApproveAll = () => {
    // bulk approve API call here using selectedIds
    console.log('Approving all:', selectedIds);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Registration Requests
            </h1>
            <p className="text-muted-foreground">
              Review and manage all pending course registration requests.
            </p>
          </div>

          <Button
            onClick={handleApproveAll}
            disabled={selectedIds.length === 0}
            variant="default"
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white dark:text-black"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Selected
          </Button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>

          <Select
            value={filterStatus}
            onValueChange={value => {
              setFilterStatus(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortOrder}
            onValueChange={value => {
              setSortOrder(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="w-[40px] pl-6">
                      <Checkbox
                        checked={
                          selectedIds.length === registrations.length &&
                          registrations.length > 0
                        }
                        onCheckedChange={checked =>
                          handleSelectAll(checked as boolean)
                        }
                      />
                    </TableHead>
                    <TableHead className="font-bold text-foreground w-[60px]">
                      #
                    </TableHead>
                    <TableHead className="font-bold text-foreground w-[200px]">
                      Name
                    </TableHead>
                    <TableHead className="font-bold text-foreground w-[250px]">
                      Email
                    </TableHead>
                    <TableHead className="font-bold text-foreground w-[150px]">
                      Status
                    </TableHead>
                    <TableHead className="font-bold text-foreground pr-6 w-[250px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-muted-foreground">
                            Loading registrations...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : registrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-foreground text-xl font-semibold mb-2">
                          No Registrations Found
                        </p>
                        <p className="text-muted-foreground">
                          There are no course registration requests yet.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations.map((reg: any, index: number) => (
                      <TableRow
                        key={reg._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                      >
                        <TableCell className="pl-6 py-4">
                          <Checkbox
                            checked={selectedIds.includes(reg._id)}
                            onCheckedChange={checked =>
                              handleSelectRow(reg._id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="py-4">{index + 1}</TableCell>
                        <TableCell className="py-4 font-medium">
                          {reg.detail.name}
                        </TableCell>
                        <TableCell className="py-4">
                          {reg.detail.email}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant={
                              reg.status === 'approved'
                                ? 'default'
                                : reg.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {reg.status.charAt(0).toUpperCase() +
                              reg.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 pr-6">
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRegistration(reg)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            {reg.status === 'pending' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    console.log('approve', reg._id)
                                  }
                                  className="bg-green-600 hover:bg-green-500 text-white dark:text-black"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => console.log('reject', reg._id)}
                                  className="bg-red-600 dark:bg-red-700 hover:dark:bg-red-600 hover:bg-red-500 text-white dark:text-black"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {selectedRegistration && (
                    <Dialog
                      open={!!selectedRegistration}
                      onOpenChange={() => setSelectedRegistration(null)}
                    >
                      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto py-8">
                        <DialogHeader className="pb-4">
                          <DialogTitle className="flex items-center gap-2 text-xl">
                            <User className="h-5 w-5 text-primary" />
                            Registration Details
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                          <Card>
                            <CardContent className="p-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Name:</span>{' '}
                                  {selectedRegistration.detail.name}
                                </div>
                                <div>
                                  <span className="font-medium">Email:</span>{' '}
                                  {selectedRegistration.detail.email}
                                </div>
                                <div>
                                  <span className="font-medium">Mobile:</span>{' '}
                                  {selectedRegistration.detail.mobile}
                                </div>
                                <div>
                                  <span className="font-medium">Gender:</span>{' '}
                                  {selectedRegistration.detail.gender}
                                </div>
                                <div>
                                  <span className="font-medium">City:</span>{' '}
                                  {selectedRegistration.detail.city}
                                </div>
                                <div>
                                  <span className="font-medium">State:</span>{' '}
                                  {selectedRegistration.detail.state}
                                </div>
                                <div>
                                  <span className="font-medium">Category:</span>{' '}
                                  {selectedRegistration.detail.category}
                                </div>
                                <div>
                                  <span className="font-medium">
                                    University:
                                  </span>{' '}
                                  {selectedRegistration.detail.university}
                                </div>
                              </div>
                              <Separator className="my-4" />
                              <p className="text-sm text-muted-foreground">
                                Registered on:{' '}
                                {new Date(
                                  selectedRegistration.createdAt,
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

