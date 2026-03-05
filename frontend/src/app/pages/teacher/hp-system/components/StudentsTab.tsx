import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHpStudents } from "@/hooks/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, History, Mail, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUp, ArrowDown } from "lucide-react"

interface StudentsTabProps {
  courseVersionId: string;
  cohortName: string;
}

export function StudentsTab({ courseVersionId, cohortName }: StudentsTabProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "hp" | "completion">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;
  const navigate = useNavigate();

  const { data: students = [], isLoading } = useHpStudents(
    courseVersionId,
    cohortName
  );

  const filteredStudents = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });
  const handleSort = (key: typeof sortKey) => {
  if (sortKey === key) {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
  } else {
    setSortKey(key)
    setSortOrder("asc")
  }
}
  const sortedStudents = [...filteredStudents].sort((a,b) => {

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
      <div className="relative max-w-md">
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

      {/* Student Count */}
      <div className="text-sm text-muted-foreground">
        {filteredStudents.length} student
        {filteredStudents.length !== 1 ? "s" : ""}
      </div>

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
                  className="text-left px-4 py-3 cursor-pointer hover:text-primary"
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
                  className="text-center px-4 py-3 cursor-pointer hover:text-primary"
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
                    className="text-center px-4 py-3 cursor-pointer hover:text-primary"
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

                  {/* Actions */}
                  <td className="text-center px-4 py-3 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(
                            cohortName
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
                            cohortName
                          )}/student/${student._id}/ledger`,
                        })
                      }
                    >
                      <History className="h-4 w-4 mr-1" />
                      HP History
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
        <CardContent className="flex flex-col items-center gap-3 p-3">

          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • {filteredStudents.length} total
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              {"<"}
            </Button>

            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                size="icon"
                variant={currentPage === i + 1 ? "default" : "outline"}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}

            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              {">"}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}