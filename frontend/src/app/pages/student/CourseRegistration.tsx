import { studentCourseInviteRegistration } from '@/app/routes/router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useGetCourseRegistration, useSubmitCourseRegistration } from '@/hooks/hooks';
import { useParams } from '@tanstack/react-router';
import React, { useState } from 'react';
import { toast } from 'sonner';


const FormError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
};

interface IModule {
  id: string;
  name: string;
  description: string;
  itemsCount: number
}

interface ICourseVersion {
  id?: string;
  courseId: string;
  version: string;
  description: string;
  modules: IModule[];
  totalItems?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ICourse {
  id?: string;
  name: string;
  description: string;
  versions: string[];
  instructors: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VersionWithCourse extends ICourseVersion {
  course: ICourse;
  instructors: {name: string, profileImage: string}[];
}


const CourseRegistration: React.FC = () => {

  const { versionId } = useParams({ from: studentCourseInviteRegistration.id });

  // const [version, setVersion] = useState<VersionWithCourse | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [university, setUniversity] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const {data: versionData, isLoading: isLoadingVersionData} = useGetCourseRegistration(versionId);
  const {mutateAsync: submitRegistration, isPending: isSubmitting} = useSubmitCourseRegistration();

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email";

    if (!mobile.trim()) newErrors.mobile = "Mobile number is required";
    else if (!/^\d{10}$/.test(mobile))
      newErrors.mobile = "Enter a valid 10-digit mobile number";

    if (!gender) newErrors.gender = "Gender is required";
    if (!city.trim()) newErrors.city = "City is required";
    if (!state.trim()) newErrors.stateName = "State is required";
    if (!category) newErrors.category = "Category is required";
    if (!university.trim()) newErrors.university = "University is required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0; 
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {

      await submitRegistration({
        params: {
          path: {
            versionId: versionId || '',
          },
        },
        body: {
          name,
          email,
          mobile,
          gender,
          city,
          state,
          category,
          university,
        },
      });

      toast.success('You have been registered for this course version.');
      setIsDialogOpen(false);
      setErrors({});
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong, please try again.');
    } 
  };

  const resetForm = () => {
  setName('');
  setEmail('');
  setMobile('');
  setGender('');
  setCity('');
  setState('');
  setCategory('');
  setUniversity('');
};


  if (isLoadingVersionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course data ...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-pretty text-2xl md:text-3xl font-semibold text-foreground">
          Register for {versionData?.course?.name}
        </h1>
        <p className="text-pretty text-sm md:text-base text-muted-foreground">
          {versionData?.course?.description}
        </p>
      </header>

      <section className="w-full">
        <Card className="w-full border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-bold">
              Course Version {versionData?.version}
            </CardTitle>
            <CardDescription className="text-pretty">
              {versionData?.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  Total Items: {versionData?.totalItems}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="block">Created On</span>
                  <span className="font-medium text-foreground">
                    {formatDate(versionData?.createdAt?.toString())}
                  </span>
                </div>
                <div>
                  <span className="block">Last Updated</span>
                  <span className="font-medium text-foreground">
                    {formatDate(versionData?.updatedAt?.toString())}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Register for this Version
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide your details to enroll in this course version.
              </p>

               <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="w-full">Begin Registration</Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-lg mb-3 font-semibold">
                      Course Registration Form
                    </DialogTitle>
                  </DialogHeader>

                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            setErrors(prev => ({ ...prev, name: undefined }));
                          }}
                          placeholder="Enter your full name"
                          className={errors.name ? "border-red-500" : ""}
                        />
                        <FormError message={errors.name} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrors(prev => ({ ...prev, email: undefined }));
                          }}
                          placeholder="example@domain.com"
                          className={errors.email ? "border-red-500" : ""}
                        />
                        <FormError message={errors.email} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mobile">Mobile Number</Label>
                        <Input
                          id="mobile"
                          type="tel"
                          value={mobile}
                          onChange={(e) => {
                            setMobile(e.target.value);
                            setErrors(prev => ({ ...prev, mobile: undefined }));
                          }}
                          placeholder="Enter mobile number"
                          className={errors.mobile ? "border-red-500" : ""}
                        />
                        <FormError message={errors.mobile} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          value={gender}
                          onChange={(e) => {
                            setGender(e.target.value);
                            setErrors(prev => ({ ...prev, gender: undefined }));
                          }}
                          className={`w-full rounded-md border px-3 py-2 text-sm bg-background ${
                            errors.gender ? "border-red-500" : ""
                          }`}
                        >
                          <option value="">Select gender</option>
                          <option value="MALE">Male</option>
                          <option value="FEMAIL">Female</option>
                          <option value="OTHERS">Other</option>
                        </select>
                        <FormError message={errors.gender} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setErrors(prev => ({ ...prev, city: undefined }));
                          }}
                          placeholder="Enter city"
                          className={errors.city ? "border-red-500" : ""}
                        />
                        <FormError message={errors.city} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={state}
                          onChange={(e) => {
                            setState(e.target.value);
                            setErrors(prev => ({ ...prev, stateName: undefined }));
                          }}
                          placeholder="Enter state"
                          className={errors.stateName ? "border-red-500" : ""}
                        />
                        <FormError message={errors.stateName} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            setErrors(prev => ({ ...prev, category: undefined }));
                          }}
                          className={`w-full rounded-md border px-3 py-2 text-sm bg-background ${
                            errors.category ? "border-red-500" : ""
                          }`}
                        >
                          <option value="">Select category</option>
                          <option value="GENERAL">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="OTHERS">Others</option>
                        </select>
                        <FormError message={errors.category} />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="university">University</Label>
                        <Input
                          id="university"
                          value={university}
                          onChange={(e) => {
                            setUniversity(e.target.value);
                            setErrors(prev => ({ ...prev, university: undefined }));
                          }}
                          placeholder="Enter university name"
                          className={errors.university ? "border-red-500" : ""}
                        />
                        <FormError message={errors.university} />
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </section>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Modules</h2>
            <p className="text-sm text-muted-foreground">
              Lessons included in this version
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowModules(s => !s)}>
            {showModules ? 'Hide lessons' : 'View lessons'}
          </Button>
        </div>
        {showModules && (
          <>
            {(() => {
              const allModules = versionData?.modules ?? [];
              const preview = allModules.slice(0, 6);
              return (
                <ScrollArea className="min-h-48 max-h-96 w-full pr-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    {preview.map((m, idx) => (
                      <Card key={(m as any)._id ?? (m as any).title ?? idx}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start gap-3">
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground"
                              aria-hidden="true"
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <CardTitle className="text-lg">
                                {(m as any).title ?? (m as any).name}
                              </CardTitle>
                              {(m as any).description ? (
                                <CardDescription className="text-pretty">
                                  {(m as any).description}
                                </CardDescription>
                              ) : null}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Badge variant="outline">
                            {((m as any).itemsCount ?? 0).toString()} items
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              );
            })()}
          </>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Instructors</h2>
          <p className="text-sm text-muted-foreground">
            Instructors enrolled in this course
          </p>
        </div>
        {(() => {
          const instructors = versionData?.instructors ?? [];
          const preview = instructors.slice(0, 6);
          const remaining = instructors.slice(6);

          const renderItem = (instructor: { name: string; profileImage: string }) => {
            const initials = instructor.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
                key={instructor.name}
              >
                {/* <Avatar className="h-9 w-9">
                  {instructor.profileImage ? (
                    <AvatarImage src={instructor.profileImage} alt={instructor.name} onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}/>
                  ) : (
                    <AvatarFallback>{initials}</AvatarFallback>
                  )}
                </Avatar> */}
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{instructor.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Instructor</p>
                </div>
              </div>
            );
          };

          if (instructors.length === 0) {
            return (
              <p className="text-sm text-muted-foreground">
                No instructors listed yet.
              </p>
            );
          }

          return (
            <div className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {preview.map((ins) => (
                  <li key={ins.name}>{renderItem(ins)}</li>
                ))}
              </ul>

              {remaining.length > 0 && (
                <details className="group rounded-lg border bg-card">
                  <summary className="cursor-pointer list-none px-4 py-3 hover:bg-muted/50">
                    <span className="font-medium">
                      Show all {instructors.length} instructors
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      (includes {remaining.length} more)
                    </span>
                  </summary>
                  <div className="px-4 pb-4">
                    <ul className="max-h-80 overflow-y-auto grid gap-3 sm:grid-cols-2 md:grid-cols-3 pt-2">
                      {remaining.map((ins) => (
                        <li key={ins.name}>{renderItem(ins)}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </div>
          );
        })()}
      </section>
    </main>
  );
};


export default CourseRegistration;