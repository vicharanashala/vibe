import { useEffect, useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

import { useCourseVersionAuditDetails } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowBigDownDashIcon } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
function isIdKey(key: string) {
  return key.toLowerCase().includes("id");
}

function humanizeKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase());
}

function renderValue(value: any): React.ReactNode {
  if (value === null || value === undefined) return "-";
  if (value?.buffer?.type === "Buffer") return null;

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="bg-muted/40 p-2 rounded">
            {renderValue(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-1 text-xs">
        {Object.entries(value).map(([key, val]) => {
          if (isIdKey(key)) return null;
          return (
            <div key={key}>
              <span className="font-medium">
                {humanizeKey(key)}:{" "}
              </span>
              {renderValue(val)}
            </div>
          );
        })}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function getChangeRows(before?: any, after?: any) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  return Array.from(keys)
    .filter((key) => !isIdKey(key))
    .map((key) => ({
      field: key,
      before: before?.[key],
      after: after?.[key],
    }));
}

const AuditPage = () => {
  const courseId =
    typeof window !== "undefined"
      ? localStorage.getItem("selectedCourseId")
      : null;

  const versions =
    typeof window !== "undefined"
      ? JSON.parse(
          localStorage.getItem("selectedCourseVersions") || "[]"
        )
      : [];

  const [selectedVersionId, setSelectedVersionId] =
    useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [startDate, setStartDate] = useState<string | undefined>(undefined);
const [endDate, setEndDate] = useState<string | undefined>(undefined);
const limit = 5;

  // ✅ Set default version (first one)
  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0]);
    }
  }, [versions, selectedVersionId]);

  const { data, isLoading, error } =
    useCourseVersionAuditDetails(
      courseId!,
      selectedVersionId!,
      page,
      limit,
        startDate,
  endDate
    );

  if (!courseId) {
    return <div className="p-6">No course selected.</div>;
  }

  if (isLoading) {
    return <div className="p-6">Loading audit trails...</div>;
  }

  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  const auditTrails = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Audit Trails
      </h1>

      {/* 🔥 Version Dropdown */}
           <div className="flex flex-wrap items-center gap-4">
  {/* Version Dropdown */}
  {versions.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="border px-4 py-2 rounded-md text-sm font-medium">
          <ArrowBigDownDashIcon className="mr-2 h-4 w-4" />
          {selectedVersionId
            ? `Version v${
                versions.indexOf(selectedVersionId) + 1
              }.0`
            : "Select Version"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={selectedVersionId || ""}
          onValueChange={(value) => {
            setSelectedVersionId(value);
            setPage(1);
          }}
        >
          {versions.map(
            (versionId: string, index: number) => (
              <DropdownMenuRadioItem
                key={versionId}
                value={versionId}
              >
                v{index + 1}.0
              </DropdownMenuRadioItem>
            )
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )}

  {/* From Date */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">
      From:
    </span>
    <Input
      type="date"
      value={startDate || ""}
      onChange={(e) => {
        setStartDate(e.target.value || undefined);
        setPage(1);
      }}
      className="w-[160px]"
    />
  </div>

  {/* To Date */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">
      To:
    </span>
    <Input
      type="date"
      value={endDate || ""}
      onChange={(e) => {
        setEndDate(e.target.value || undefined);
        setPage(1);
      }}
      className="w-[160px]"
    />
  </div>

  {/* Clear Filter Button */}
  {(startDate || endDate) && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPage(1);
      }}
    >
      Clear Dates
    </Button>
  )}
</div>

      {auditTrails.length === 0 && (
        <div className="text-muted-foreground">
          No audit records found.
        </div>
      )}

      {auditTrails.map((audit: any, index: number) => {
        const rows = getChangeRows(
          audit?.changes?.before,
          audit?.changes?.after
        );

        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{audit.action}</CardTitle>
                  <CardDescription>
                    Category: {audit.category}
                  </CardDescription>
                  <CardDescription>
                    {audit.createdAt
                      ? new Date(
                          audit.createdAt
                        ).toLocaleString()
                      : ""}
                  </CardDescription>
                </div>

                <span
                  className={`px-3 py-1 text-xs rounded-md font-medium ${
                    audit.outcome?.status === "SUCCESS"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {audit.outcome?.status}
                </span>
              </div>
            </CardHeader>

            {rows.length > 0 && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      {audit?.changes?.before && (
                        <TableHead>Before</TableHead>
                      )}
                      {audit?.changes?.after && (
                        <TableHead>After</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.field}>
                        <TableCell className="font-medium">
                          {humanizeKey(row.field)}
                        </TableCell>

                        {audit?.changes?.before && (
                          <TableCell>
                            {renderValue(row.before)}
                          </TableCell>
                        )}

                        {audit?.changes?.after && (
                          <TableCell>
                            {renderValue(row.after)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
      {data && data.totalPages > 1 && (
  <Pagination
    currentPage={data.currentPage}
    totalPages={data.totalPages}
    totalDocuments={data.totalDocuments}
    onPageChange={(newPage) => setPage(newPage)}
  />
)}
    </div>
  );
};

export default AuditPage;