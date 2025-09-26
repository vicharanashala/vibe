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
import { useSearch } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

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

interface VersionWithCourse extends ICourseVersion {
  course: ICourse;
  instructorNames: string[];
}

const CourseRegistration: React.FC = () => {

  const url = new URL(window.location.href);
  const pathParts = url.pathname.split('/'); 
  const courseId = pathParts[pathParts.length - 1];

  // const params = useParams();
  // const courseId = params.courseId;
    // const courseId = window.location.pathname.split('/').pop();

  //   const search = useSearch({ from: studentCourseInviteRegistration as any });
  // const courseId = search.courseId; 

  const [version, setVersion] = useState<VersionWithCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [category, setCategory] = useState('');
  const [university, setUniversity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showModules, setShowModules] = useState(false);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  };

  useEffect(() => {
    const mockVersion: VersionWithCourse = {
      id: 'v1',
      courseId: '1',
      version: 'v1.0 - React Fundamentals',
      description:
        'Learn the core concepts of React development including components, JSX, state management, and event handling. Perfect for beginners starting their React journey.',
      modules: [
        {
          id: '1',
          name: 'Introduction to React',
          description:
            'Understanding React philosophy and component-based architecture',
            itemsCount: 3
        },
        {
          id: '2',
          name: 'JSX and Components',
          description: 'Learn JSX syntax and how to create reusable components',
          itemsCount: 3
        },
        {
          id: '3',
          name: 'State and Props',
          description:
            'Managing component state and passing data between components',
            itemsCount: 3
        },
        {
          id: '4',
          name: 'Event Handling',
          description: 'Handling user interactions and form submissions',
          itemsCount: 3
        },
        {
          id: '5',
          name: 'Project: Todo Application',
          description: 'Build a complete todo app using learned concepts',
          itemsCount: 3
        },
      ],
      totalItems: 15,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-02-01'),
      course: {
        id: '1',
        name: 'Introduction to React Development',
        description:
          'A comprehensive course series covering React development from basics to advanced concepts. Learn to build modern web applications with confidence.',
        versions: ['v1', 'v2'],
        instructors: ['inst1', 'inst2'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-03-01'),
      },
      instructorNames: ['Dr. Sarah Johnson', 'Prof. Michael Chen'],
    };

    setTimeout(() => {
      setVersion(mockVersion);
      setLoading(false);
    }, 1000);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !mobile.trim()) {
      toast.error('Missing information');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          courseId: version?.courseId,
          versionId: version?.id,
          name,
          email,
          mobile,
          gender,
          city,
          state: stateName,
          category,
          university,
        }),
      });
      if (!res.ok) throw new Error('Registration failed');
      toast('You have been registered for this course version.');
      setName('');
      setEmail('');
      setMobile('');
      setGender('');
      setCity('');
      setStateName('');
      setCategory('');
      setUniversity('');
      setIsDialogOpen(false);
    } catch (err: any) {
      toast('Something went wrong, Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available course versions...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8">
      Course id: {courseId}
      <header className="space-y-1">
        <h1 className="text-pretty text-2xl md:text-3xl font-semibold text-foreground">
          Register for {version?.course.name}
        </h1>
        <p className="text-pretty text-sm md:text-base text-muted-foreground">
          {version?.course.description}
        </p>
      </header>

      <section className="w-full">
        <Card className="w-full border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-bold">
              Course Version {version?.version}
            </CardTitle>
            <CardDescription className="text-pretty">
              {version?.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Version Information */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  Total Items: {version?.totalItems}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="block">Created On</span>
                  <span className="font-medium text-foreground">
                    {formatDate(version?.createdAt.toString())}
                  </span>
                </div>
                <div>
                  <span className="block">Last Updated</span>
                  <span className="font-medium text-foreground">
                    {formatDate(version?.updatedAt.toString())}
                  </span>
                </div>
              </div>
            </section>

            {/* Registration Section */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Register for this Version
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide your details to enroll in this course version.
              </p>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                          onChange={e => setName(e.target.value)}
                          required
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          placeholder="example@domain.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mobile">Mobile Number</Label>
                        <Input
                          id="mobile"
                          type="tel"
                          value={mobile}
                          onChange={e => setMobile(e.target.value)}
                          required
                          placeholder="Enter mobile number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          value={gender}
                          onChange={e => setGender(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={stateName}
                          onChange={e => setStateName(e.target.value)}
                          placeholder="Enter state"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                        >
                          <option value="">Select category</option>
                          <option value="General">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="university">University</Label>
                        <Input
                          id="university"
                          value={university}
                          onChange={e => setUniversity(e.target.value)}
                          placeholder="Enter university name"
                        />
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
                      <Button type="submit" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit'}
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
              const allModules = version?.modules ?? [];
              const preview = allModules.slice(0, 6);
              return (
                <ScrollArea className="h-96 w-full pr-2">
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
          const names = version?.course.instructors ?? [];
          const preview = names.slice(0, 6);
          const remaining = names.slice(6);
          const renderItem = (name: string) => {
            const initials = name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
                key={name}
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Instructor
                  </p>
                </div>
              </div>
            );
          };

          return names.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No instructors listed yet.
            </p>
          ) : (
            <div className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {preview.map(n => (
                  <li key={n}>{renderItem(n)}</li>
                ))}
              </ul>

              {remaining.length > 0 && (
                <details className="group rounded-lg border bg-card">
                  <summary className="cursor-pointer list-none px-4 py-3 hover:bg-muted/50">
                    <span className="font-medium">
                      Show all {names.length} instructors
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      (includes {remaining.length} more)
                    </span>
                  </summary>
                  <div className="px-4 pb-4">
                    <ul className="max-h-80 overflow-y-auto grid gap-3 sm:grid-cols-2 md:grid-cols-3 pt-2">
                      {remaining.map(n => (
                        <li key={n}>{renderItem(n)}</li>
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