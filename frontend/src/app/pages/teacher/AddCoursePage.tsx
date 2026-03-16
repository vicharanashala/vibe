import { JSX, SetStateAction, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, Plus, AlertCircle, CheckCircle, Rocket, GitBranch, HelpCircle, Lightbulb, Info, GraduationCap } from "lucide-react";
import { useCreateCourse } from "@/hooks/hooks";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const MAX_DESCRIPTION_LENGTH = 1000;

type CreateErrors = {
  courseName: string;
  courseDescription: string;
  versionName: string;
  versionDescription: string;
};

export default function CreateCourse() {

  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [hpSystemEnabled, setHpSystemEnabled] = useState<boolean>(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createErrors, setCreateErrors] = useState<CreateErrors>({ courseName: "", courseDescription: "", versionName: "", versionDescription: "" });

  const createCourseMutation = useCreateCourse();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleCreateCourse = async () => {
    if (!courseName.trim() || !courseDescription.trim() || !versionName.trim() || !versionDescription.trim() || versionName.trim().length < 3) {
      const errors = {
        courseName: !courseName.trim() ? "Course Name is required" : "",
        courseDescription: !courseDescription.trim() ? "Course description is required" : "",
        versionName: !versionName.trim() ? "Version Name is required" : versionName.trim().length < 3 ? "Version Name must be at least 3 characters" : "",
        versionDescription: !versionDescription.trim() ? "Version description is required" : "",
      };
      setCreateErrors(errors);

      // Show toast for the first error found
      const firstError = Object.values(errors).find(error => error);
      if (firstError) {
        toast.error(firstError, {
          position: 'top-right',
          duration: 5000,
        });
      }
      return;
    }
    setCreateErrors({ courseName: "", courseDescription: "", versionName: "", versionDescription: "" });
    setSuccess(false);
    setError(null);
    try {
      const res = await createCourseMutation.mutateAsync({
        body: {
          name: courseName,
          description: courseDescription,
          versionName,
          versionDescription,
          cohorts,
          hpSystem:hpSystemEnabled
        }
      });

      const id = res?._id;

      if (id) {
        setSuccess(true);
        setCourseName("");
        setCourseDescription("");
        setCohorts([]);
        queryClient.invalidateQueries({
          queryKey: ["get", "/users/enrollments"],
          exact: false, // let it match all queries with different params
        });

        setTimeout(() => {
          navigate({ to: "/teacher" });
        }, 1500);

      } else {
        const errorMsg = "Course created but no ID returned";
        setError(errorMsg);
        toast.error(errorMsg, {
          position: 'top-right',
          duration: 5000,
        });
      }
    } catch (err: any) {
      let errorMsg = "Failed to create course";

      // Extract error message from the error object
      if (err?.errors?.length > 0) {
        errorMsg = (Object.values(err.errors[0].constraints || {})[0] as string);
      }
      else if (err?.message) {
        errorMsg = err.message;
      } else if (err?.data?.message) {
        errorMsg = err.data.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }

      setError(errorMsg);
      toast.error(errorMsg, {
        position: 'top-right',
        duration: 5000,
      });
    }
  };

  return (
    <div>
      <div className="max-w-4xl mx-auto py-4 space-y-8">
        <CreateCourseHeader />

        <div className="space-y-8">

          <CourseMetaForm
            courseDescription={courseDescription}
            courseName={courseName}
            createErrors={createErrors}
            setCourseDescription={setCourseDescription}
            setCourseName={setCourseName}
            setCreateErrors={setCreateErrors}
          />

          <CourseVersionMetaForm
            versionDescription={versionDescription}
            versionName={versionName}
            createErrors={createErrors}
            setVersionDescription={setVersionDescription}
            setVersionName={setVersionName}
            setCreateErrors={setCreateErrors}
            cohorts={cohorts}
            setCohorts={setCohorts}
          />

          <HpCard 
            hpSystemEnabled={hpSystemEnabled}
            setHpSystemEnabled={setHpSystemEnabled}
          />


          <CreateCourseCard
            handleCreateCourse={handleCreateCourse}
            isPending={createCourseMutation.isPending}
          />

          {success && (
            <Alert
              type="success"
              title="Course created successfully!"
              message="Navigating to your dashboard..."
            />
          )}

          {error && (
            <Alert
              type="error"
              title="Error creating course"
              message={error}
            />
          )}

        </div>
      </div>
    </div>
  );
}




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< COMPONENTS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// Alert Message
const alertConfig: Record<
  AlertType,
  {
    icon: JSX.Element;
    bg: string;
    border: string;
    text: string;
    iconBg: string;
  }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/30",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5" />,
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/30",
  },
};

type AlertType = "success" | "error";

type AlertProps = {
  type: AlertType;
  title: string;
  message?: string;
};

const Alert = ({ type, title, message }: AlertProps) => {
  const config = alertConfig[type];

  return (
    <div
      className={`flex items-center gap-3 p-5 rounded-xl shadow-sm ${config.bg} ${config.border} ${config.text}`}
    >
      <div className={`p-1 rounded-full ${config.iconBg}`}>
        {config.icon}
      </div>

      <div>
        <span className="font-semibold text-base">{title}</span>
        {message && <div className="text-sm opacity-90">{message}</div>}
      </div>
    </div>
  );
}


// Error Messages

type ErrorMessageProps = {
  message?: string;
};

export const ErrorMessage = ({ message }: ErrorMessageProps) => {
  if (!message) return null;

  return (
    <div className="text-red-500 text-sm flex items-center sm:gap-2 gap-1 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
      <AlertCircle className="sm:h-4 h-3 sm:w-4 w-3 shrink-0" />
      <span className="text-xs sm:text-sm">{message}</span>
    </div>
  );
}

// Course Header
export const CreateCourseHeader = () => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
      <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
            <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">Create New Course</h1>
        </div>
        <p className="text-muted-foreground text-sm md:text-base">Build amazing learning experiences for your students</p>
        <p className="mt-2 text-xs md:text-sm text-gray-500 flex items-center gap-1.5 italic">
          <svg
            className="w-4 h-5 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Only administrators can create new courses.
        </p>
      </div>
    </div>
  )
}

// Course Meta Form
type CourseMetaFormProps = {
  courseName: string;
  setCourseName: (value: string) => void;
  courseDescription: string;
  setCourseDescription: (value: string) => void;
  createErrors: CreateErrors;
  setCreateErrors: React.Dispatch<React.SetStateAction<CreateErrors>>;
};

export const CourseMetaForm: React.FC<CourseMetaFormProps> = ({
  courseName,
  setCourseName,
  createErrors,
  courseDescription,
  setCourseDescription,
  setCreateErrors,
}) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl blur-sm"></div>
      <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-8">
        <div className="space-y-6">
          <div className="border-l-4 border-primary/30 pl-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-lg blur-sm"></div>
                <div className="relative bg-gradient-to-r from-primary to-primary/80 p-2 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Course Information
              </h3>
            </div>
            <p className="text-muted-foreground sm:pl-11 pl-0">
              Define the core details of your course. This information will be
              displayed to students and helps them understand what they'll
              learn.
            </p>
          </div>

          <div className="grid gap-6 sm:pl-6 pl-0">
            <div className="space-y-3">
              <Label
                htmlFor="courseTitle"
                className="text-sm font-semibold text-foreground flex sm:flex-row flex-col sm:items-center items-start gap-2"
              >
                Course Title *
                <span className="text-xs text-muted-foreground font-normal">
                  (This will be the main course name)
                </span>
              </Label>
              <Input
                id="courseTitle"
                className="bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 h-12 text-base"
                placeholder="e.g., Foundations of Mathematics, Principles of Economics..."
                value={courseName}
                onChange={e => {
                  setCourseName(e.target.value);
                  // Clear error when user starts typing
                  if (createErrors.courseName) {
                    setCreateErrors(prev => ({ ...prev, courseName: "" }));
                  }
                }}
              />
              {createErrors?.courseName && (
                <ErrorMessage message={createErrors?.courseName} />
              )}
            </div>

            <div className="space-y-3 overflow-auto">
              <Label
                htmlFor="courseDescription"
                className="text-sm font-semibold text-foreground flex sm:flex-row flex-col sm:items-center items-start gap-2"
              >
                Course Description *
                <span className="text-xs text-muted-foreground font-normal">
                  (Detailed overview for students)
                </span>
              </Label>
              <div className="relative">
                <Textarea
                  id="courseDescription"
                  className="bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 min-h-[130px] resize-none text-base pr-16 w-full"
                  placeholder="Provide a comprehensive description of what students will learn, the skills they'll gain, and any prerequisites..."
                  value={courseDescription}
                  onChange={e => {
                    if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                      setCourseDescription(e.target.value);
                      // Clear error when user starts typing
                      if (createErrors.courseDescription) {
                        setCreateErrors(prev => ({ ...prev, courseDescription: "" }));
                      }
                    }
                  }}
                />
                <div className={`absolute bottom-2 right-2 text-xs ${courseDescription.length >= MAX_DESCRIPTION_LENGTH * 0.9
                  ? 'text-destructive'
                  : 'text-muted-foreground'
                  }`}>
                  {courseDescription.length}/{MAX_DESCRIPTION_LENGTH}
                </div>
                {createErrors?.courseDescription && (
                  <ErrorMessage message={createErrors?.courseDescription} />
                )}
                {courseDescription.length > MAX_DESCRIPTION_LENGTH && (
                  <p className="text-sm text-destructive mt-1">
                    Description must be less than {MAX_DESCRIPTION_LENGTH} characters
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Course version Meta Form
type CourseVersionMetaFormProps = {
  versionName: string;
  setVersionName: (value: string) => void;
  versionDescription: string;
  setVersionDescription: (value: string) => void;
  createErrors: CreateErrors;
  setCreateErrors: React.Dispatch<React.SetStateAction<CreateErrors>>;
  cohorts: string[];
  setCohorts: React.Dispatch<React.SetStateAction<string[]>>;
};

const CourseVersionMetaForm: React.FC<CourseVersionMetaFormProps> = ({
  versionName,
  setVersionName,
  createErrors,
  versionDescription,
  setVersionDescription,
  setCreateErrors,
  cohorts,
  setCohorts
}) => {
  const [cohortInput, setCohortInput] = useState("");
  const MAX_COHORTS = 10;
  const addCohort = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return;
    if (cohorts.includes(trimmed)) return;
    if (cohorts.length >= MAX_COHORTS) return;

    setCohorts(prev => [...prev, trimmed.toLocaleLowerCase()]);
    setCohortInput("");
  };
  const removeCohort = (cohortToRemove: string) => {
    setCohorts(prev => prev.filter(cohort => cohort !== cohortToRemove));
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCohort(cohortInput);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-accent/10 rounded-xl blur-sm"></div>
      <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-8">
        <div className="space-y-6">
          <div className="border-l-4 border-accent/30 pl-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-accent to-accent/80 rounded-lg blur-sm"></div>
                <div className="relative bg-gradient-to-r from-accent to-accent/80 p-2 rounded-lg">
                  <GitBranch className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Initial Version Setup
              </h3>

              <div className="relative group">
                <div className="cursor-help">
                  <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50">
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-4 text-sm text-popover-foreground lg:w-80">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      About Course Versions
                    </div>
                    <p className="text-xs leading-relaxed mb-2">
                      Versions allow you to manage different iterations of your
                      course content. Each version can have unique materials,
                      assignments, and structure while maintaining the same core
                      course identity.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Examples:</strong> v1.0, Fall 2025, Beta Release,
                      Updated Content
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-popover border-r border-b border-border rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground sm:pl-11 pl-0">
              Every course starts with an initial version. Versions help you
              organize different iterations of your content, track changes, and
              maintain course evolution over time.
            </p>
          </div>

          <div className="grid gap-6 sm:pl-6 pl-0">
            <div className="space-y-3">
              <Label
                htmlFor="versionLabel"
                className="text-sm font-semibold text-foreground flex sm:flex-row flex-col sm:items-center items-start gap-2"
              >
                Version Label *
                <span className="text-xs text-muted-foreground font-normal">
                  (Unique identifier for this version)
                </span>
              </Label>
              <Input
                id="versionLabel"
                className="bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 h-12 text-base"
                placeholder="e.g., v1.0, Fall 2025, Beta, Initial Release..."
                value={versionName}
                onChange={e => {
                  setVersionName(e.target.value);
                  if (createErrors.versionName) {
                    setCreateErrors(prev => ({ ...prev, versionName: "" }));
                  }
                }}
              />
              {createErrors?.versionName && (
                <ErrorMessage message={createErrors?.versionName} />
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <div><Lightbulb className="h-4 w-4" /></div>
                <span>
                  Pro tip: Use semantic versioning (v1.0) or term-based labels
                  (Fall 2025)
                </span>
              </div>
            </div>

            <div className="space-y-3 overflow-auto">
              <Label
                htmlFor="versionDescription"
                className="text-sm font-semibold text-foreground flex sm:flex-row flex-col sm:items-center items-start gap-2"
              >
                Version Description *
                <span className="text-xs text-muted-foreground font-normal">
                  (What's special about this version?)
                </span>
              </Label>
              <div className="relative">
                <Textarea
                  id="versionDescription"
                  className="bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300 min-h-[110px] resize-none text-base pr-16"
                  placeholder="Describe what makes this version unique, any major updates, target audience, or special features..."
                  value={versionDescription}
                  onChange={e => {
                    if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                      setVersionDescription(e.target.value);
                      if (createErrors.versionDescription) {
                        setCreateErrors(prev => ({ ...prev, versionDescription: "" }));
                      }
                    }
                  }}
                />
                <div className={`absolute bottom-2 right-2 text-xs ${versionDescription.length >= MAX_DESCRIPTION_LENGTH * 0.9
                  ? 'text-destructive'
                  : 'text-muted-foreground'
                  }`}>
                  {versionDescription.length}/{MAX_DESCRIPTION_LENGTH}
                </div>
                {createErrors?.versionDescription && (
                  <ErrorMessage message={createErrors?.versionDescription} />
                )}
                {versionDescription.length > MAX_DESCRIPTION_LENGTH && (
                  <p className="text-sm text-destructive mt-1">
                    Description must be less than {MAX_DESCRIPTION_LENGTH} characters
                  </p>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  Version Cohorts
                </label>

                <div className="flex flex-wrap items-center gap-2 border border-border rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
                  
                  {cohorts.map(cohort => (
                    <span
                      key={cohort}
                      className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
                    >
                      {cohort}
                      <button
                        type="button"
                        onClick={() => removeCohort(cohort)}
                        className="text-xs hover:text-destructive"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  <input
                    type="text"
                    value={cohortInput}
                    onChange={e => setCohortInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a cohort name and press Enter"
                    className="flex-1 bg-transparent outline-none text-sm min-w-[120px]"
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  Press Enter or comma to add cohorts (max {MAX_COHORTS})
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Create Action Section
type CreateCourseCardProps = {
  handleCreateCourse: () => void;
  isPending: boolean;
};

const CreateCourseCard = ({
  handleCreateCourse,
  isPending,
}: CreateCourseCardProps) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/3 to-accent/3 rounded-xl blur-sm"></div>

      <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="space-y-2">
            <div className="text-base font-medium text-foreground flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Ready to Launch Your Course?
            </div>
            <p className="text-sm text-muted-foreground">
              Your course will be created with the initial version and you'll be
              redirected to the dashboard to start adding content and managing
              your course.
            </p>
          </div>

          <Button
            onClick={handleCreateCourse}
            disabled={isPending}
            className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 px-8 py-4 group lg:min-w-[220px]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>

            <div className="relative flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-ping opacity-75"></div>
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                )}
              </div>
              <span className="font-bold text-lg">
                {isPending ? "Creating Course..." : "Create Course"}
              </span>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
}

type HpCardProps = {
  hpSystemEnabled: boolean;
  setHpSystemEnabled: React.Dispatch<React.SetStateAction<boolean>>;
};

const HpCard = ({
  hpSystemEnabled,
  setHpSystemEnabled,
}: HpCardProps) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl blur-sm"></div>

      <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 p-6">
        <div className="flex items-center justify-between gap-4">

          <div className="flex items-start gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
              <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                ❤️
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">HP System</Label>
              <p className="text-xs text-muted-foreground">
                Enable HP system for this course. Students can gain or lose HP
                based on activities and performance.
              </p>
            </div>
          </div>

          <Switch
            checked={hpSystemEnabled}
            onCheckedChange={() =>
              setHpSystemEnabled((prev) => !prev)
            }
          />

        </div>
      </Card>
    </div>
  );
};