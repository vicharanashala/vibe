import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHpStudents } from "@/hooks/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
interface StudentsTabProps {
    courseVersionId: string;
    cohortName: string;
}

export function StudentsTab({ courseVersionId, cohortName }: StudentsTabProps) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<"name" | "hp" | "completion">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const navigate = useNavigate();
    const { data: students = [], isLoading } = useHpStudents(courseVersionId, cohortName);

    const filteredStudents = students.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });
    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) {
            setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
              setSortKey(key);
              setSortOrder("asc");
          }
    };
    const sortedStudents = [...filteredStudents].sort((a, b) => {
        if (sortKey === "name") {
            return sortOrder === "asc"
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
          }
        
        if (sortKey === "hp") {
            return sortOrder === "asc"
                ? a.totalHp - b.totalHp
                : b.totalHp - a.totalHp;
          }

        if (sortKey === "completion") {
            return sortOrder === "asc"
                ? a.completionPercentage - b.completionPercentage
                : b.completionPercentage - a.completionPercentage;
          }

      return 0;
    });
  const paginatedStudents = sortedStudents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
        );

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
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

        {/* Student Count */}
          <div className="text-sm text-muted-foreground">
              Showing{" "}
              {(currentPage - 1) * itemsPerPage + 1}
              {"-"}
              {Math.min(currentPage * itemsPerPage, sortedStudents.length)}{" "}
              of {sortedStudents.length} students
            </div>

          {/* Table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th
                    className="text-left px-4 py-3 cursor-pointer select-none hover:text-primary"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortKey === "name" &&
                        (sortOrder === "asc"
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th
                  className="text-center px-4 py-3 w-[140px] cursor-pointer select-none hover:text-primary"
                  onClick={() => handleSort("completion")}
                  >
                    <div className="flex items-center gap-1">
                      Completion %
                      {sortKey === "completion" &&
                        (sortOrder === "asc"
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th
                  className="text-center px-4 py-3 w-[120px] cursor-pointer select-none hover:text-primary"
                  onClick={() => handleSort("hp")}
                  >
                    <div className="flex items-center gap-1">
                      Total HP
                      {sortKey === "hp" &&
                        (sortOrder === "asc"
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedStudents.map(student => (
                  <tr key={student._id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                    <td className="px-4 py-3 text-center">{student.completionPercentage}%</td>
                    <td className="px-4 py-3 text-center font-semibold">{student.totalHp}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({
                          to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName)}/student/${student._id}/submissions`
                        })}
                      >
                        View Submissions
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({
                          to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName)}/student/${student._id}/ledger`
                        })}
                      >
                        View HP History
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage * itemsPerPage >= sortedStudents.length}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </Button>
          </div>
      </div>
  );
}
