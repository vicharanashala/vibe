import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHpStudents } from "@/hooks/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, History, Mail, FileText, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResetHpDialog } from "./ResetHpDialog";
import { ResetStudentHpDialog } from "./ResetStudentHpDialog";

export interface StudentsTabProps {
  courseVersionId: string;
  cohortId: string;
  cohortName: string;
}

export function StudentsTab({ courseVersionId, cohortId, cohortName }: StudentsTabProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "hp" | "completion">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SAFE" | "UNSAFE">("ALL");
  const [openReset, setOpenReset] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [openStudentReset, setOpenStudentReset] = useState(false);

  const itemsPerPage = 10;
  const navigate = useNavigate();

  const { data: students = [], isLoading, refetch, isRefetching } = useHpStudents(
    courseVersionId,
    cohortId
  );

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SAFE" && s.isSafe) ||
      (statusFilter === "UNSAFE" && !s.isSafe);

    return matchesSearch && matchesStatus;
  });
  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortOrder("asc")
    }
  }
  const sortedStudents = [...filteredStudents].sort((a, b) => {

    if (sortKey === "name") {
      return sortOrder === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    }

    if (sortKey === "hp") {
      return sortOrder === "asc"
        ? a.totalHp - b.totalHp
        : b.totalHp - a.totalHp
    }

    if (sortKey === "completion") {
      return sortOrder === "asc"
        ? a.completionPercentage - b.completionPercentage
        : b.completionPercentage - a.completionPercentage
    }

    return 0
  })

  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage)
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value: "ALL" | "SAFE" | "UNSAFE") => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Students</SelectItem>
                <SelectItem value="SAFE">Safe</SelectItem>
                <SelectItem value="UNSAFE">Unsafe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching || isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              {isRefetching ? "Refreshing..." : "Refresh"}
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={() => setOpenReset(true)}
            >
              Reset HP
            </Button>
          </div>

      </div>

      {/* Student Count */}
      {/* <div className="text-sm text-muted-foreground">
        {filteredStudents.length} student
        {filteredStudents.length !== 1 ? "s" : ""}
      </div> */}

      {/* Table */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
          No students found.
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th
                  className="text-left px-4 py-3 cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    Student
                    {sortKey === "name" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      ))}
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 cursor-pointer"
                  onClick={() => handleSort("completion")}
                >
                  <span className="flex items-center justify-center gap-1">
                    Completion %
                    {sortKey === "completion" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      ))}
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 cursor-pointer"
                  onClick={() => handleSort("hp")}
                >
                  <span className="flex items-center justify-center gap-1">
                    Total HP
                    {sortKey === "hp" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      ))}
                  </span>
                </th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student._id} className="border-t hover:bg-muted/30">

                  {/* Student column */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                        {student.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {student.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Completion */}
                  <td className="text-center px-4 py-3">
                    {student.completionPercentage}%
                  </td>

                  {/* HP */}
                  <td className="text-center px-4 py-3 font-semibold">
                    {student.totalHp}
                  </td>

                  {/* Safe status */}
                    <td className="text-center px-4 py-3">
                      <Badge
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${
                        student.isSafe
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                      }`}
                    >
                      {student.isSafe ? "SAFE" : "UNSAFE"}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="text-center px-4 py-3 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(
                            cohortId
                          )}/student/${student._id}/submissions`,
                        })
                      }
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Submissions
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(
                            cohortId
                          )}/student/${student._id}/ledger`,
                        })
                      }
                    >
                      <History className="h-4 w-4 mr-1" />
                      HP History
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedStudent(student);
                        setOpenStudentReset(true);
                      }}
                    >
                      Reset HP
                    </Button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Card>
        <CardContent className="p-3">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalDocuments={filteredStudents.length}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
       <ResetHpDialog
        open={openReset}
        onOpenChange={setOpenReset}
        courseVersionId={courseVersionId}
        cohortName={cohortName}
        onSuccess={refetch}
      />
      <ResetStudentHpDialog
        open={openStudentReset}
        onOpenChange={setOpenStudentReset}
        student={selectedStudent}
        courseVersionId={courseVersionId}
        cohortName={cohortName}
      />
    </div>
  );
}