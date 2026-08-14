import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  FileJson,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BUNDLE_CARRIES,
  BUNDLE_OMITS,
  CourseBundle,
  importCourseBundle,
  parseCourseBundle,
  summariseBundle,
} from "@/lib/course-transfer";

type PickedBundle = {
  file: File;
  bundle: CourseBundle;
  summary: ReturnType<typeof summariseBundle>;
};

/**
 * Uploads a .vibe.json bundle exported from another ViBe server and creates the
 * course here. The importing admin becomes the instructor of the new course.
 */
export default function ImportCourseBundle() {
  const [picked, setPicked] = useState<PickedBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const acceptFile = async (file: File) => {
    setError(null);
    try {
      const bundle = await parseCourseBundle(file);
      setPicked({ file, bundle, summary: summariseBundle(bundle) });
    } catch (err: any) {
      setPicked(null);
      const message = err?.message || "Could not read that file";
      setError(message);
      toast.error(message, { position: "top-right", duration: 5000 });
    }
  };

  const handleImport = async () => {
    if (!picked) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await importCourseBundle(picked.bundle);
      queryClient.invalidateQueries({
        queryKey: ["get", "/users/enrollments"],
        exact: false,
      });
      toast.success(result.message || `Imported "${result.name}"`, {
        position: "top-right",
        duration: 5000,
      });
      setTimeout(() => {
        navigate({ to: "/teacher" });
      }, 1500);
    } catch (err: any) {
      const message = err?.message || "Failed to import the course";
      setError(message);
      toast.error(message, { position: "top-right", duration: 5000 });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="bg-card/95 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Import a course bundle
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick a <span className="font-mono text-xs">.vibe.json</span> file exported from a
              course version on another ViBe server. A new course is created here and you become
              its instructor.
            </p>
          </div>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) acceptFile(file);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Drop a bundle here, or click to choose a file
            </span>
            <span className="text-xs text-muted-foreground">
              JSON exported from a course version
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) acceptFile(file);
                // Let the same file be picked again after a failed import.
                e.target.value = "";
              }}
            />
          </div>

          {/* Picked bundle summary */}
          {picked && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {picked.bundle.course.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    Version {picked.bundle.version.version} &middot; {picked.file.name}
                  </p>
                  {picked.bundle.exportedAt && (
                    <p className="text-xs text-muted-foreground">
                      Exported {new Date(picked.bundle.exportedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPicked(null);
                    setError(null);
                  }}
                  disabled={isImporting}
                  aria-label="Remove selected bundle"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Modules", value: picked.summary.modules },
                  { label: "Sections", value: picked.summary.sections },
                  { label: "Items", value: picked.summary.items },
                  { label: "Banks", value: picked.summary.questionBanks },
                  { label: "Questions", value: picked.summary.questions },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-background/60 border border-border/50 p-2 text-center"
                  >
                    <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sm">Import failed</span>
                <div className="text-sm opacity-90">{error}</div>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleImport}
            disabled={!picked || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing&hellip; this can take a minute for a large course
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Import course
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* What travels and what does not */}
      <Card className="bg-card/95 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">What a bundle carries</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Included
              </p>
              <ul className="space-y-1.5">
                {BUNDLE_CARRIES.map(entry => (
                  <li key={entry} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-500" />
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Not included
              </p>
              <ul className="space-y-1.5">
                {BUNDLE_OMITS.map(entry => (
                  <li key={entry} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground italic">
            The imported course is always created non-public, and linear progression always comes
            up enabled — switch it off afterwards if the original had it off.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
