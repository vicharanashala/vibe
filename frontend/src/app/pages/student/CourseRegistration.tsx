import { studentCourseInviteRegistration } from '@/app/routes/router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Form from "@rjsf/shadcn";
import { useGetCourseRegistration, useGetDynamicFields, useSubmitCourseRegistration } from '@/hooks/hooks';
import { useParams } from '@tanstack/react-router';
import React, { useState } from 'react';
import { toast } from 'sonner';
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, CalendarDays, ChevronDown, ChevronUp, Clock, GraduationCap, ListChecks, Loader2, NotebookText, Play, UserPlus, Users } from 'lucide-react';


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
  instructors: { name: string, profileImage: string }[];
}

// Copied from FormBuilder for typing
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;

  // String-specific
  format?: 'email' | 'uri' | 'date' | 'date-time' | 'hostname' | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number-specific
  minimum?: number;
  maximum?: number;

  // Enum / select
  enum?: string[];

  // Object / array
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;

  // Default value
  default?: any;
}

export interface RJSFSchema {
  title?: string;
  description?: string;
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
}


const CourseRegistration: React.FC = () => {
  const { versionId } = useParams({ from: studentCourseInviteRegistration.id });

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // const [showModules, setShowModules] = useState(false);

  const { data: versionData, isLoading: isLoadingVersionData } = useGetCourseRegistration(versionId);
  const { mutateAsync: submitRegistration, isPending: isSubmitting } = useSubmitCourseRegistration();
  const { data: formFieldData, isLoading: isFormFieldsLoading } = useGetDynamicFields(versionId);

  const jsonSchema = formFieldData?.jsonSchema as RJSFSchema | undefined;
  const uiSchema = formFieldData?.uiSchema as Record<string, any> | undefined;

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  };


  const onSubmit = async (data: IChangeEvent<any>) => {
    try {

      let body: any = data.formData;
      console.log("Form data: ", body)

      const hasFiles = Object.values(data.formData).some(v => v instanceof File);
      if (hasFiles) {
        const formDataObj = new FormData();
        Object.entries(data.formData).forEach(([key, value]) => {
          if (value instanceof File) {
            formDataObj.append(key, value);
          } else if (value != null && value !== '') {
            formDataObj.append(key, String(value));
          }
        });
        body = formDataObj;
      }

      await submitRegistration({
        params: {
          path: {
            versionId: versionId || '',
          },
        },
        body,
      });

      toast.success('You have been registered for this course version.');
      setIsDialogOpen(false);
      setErrors({});
      setFormData({});
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong, please try again.');
    }
  };

  const resetForm = () => {
    setFormData({});
    setErrors({});
  };



  if (isLoadingVersionData) {
    return (
      <div className="min-h-screen flex  justify-center px-6">
        <div className="w-full max-w-3xl space-y-6">
          <Skeleton className="h-6 w-1/4 bg-gray-200 dark:bg-gray-600" />
          <Skeleton className="h-18 w-full bg-gray-200 dark:bg-gray-600" />

          <Skeleton className="h-64 w-full bg-gray-200 dark:bg-gray-600" />
          <div className="space-y-4">
            <Skeleton className="h-18 w-full bg-gray-200 dark:bg-gray-600" />
            <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-600" />
            <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-600" />
          </div>
        </div>
      </div>
    );
  }


  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
            <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-pretty text-2xl md:text-3xl font-semibold text-foreground">
            Register for {versionData?.course?.name}
          </h1>
        </div>
        <p className="text-pretty text-sm md:text-base text-muted-foreground">
          {versionData?.course?.description}
        </p>
      </header>

      <section className="w-full">
        <Card className="w-full border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-lg blur-sm"></div>
                <div className="relative bg-gradient-to-r from-primary to-primary/80 p-2 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>

              <CardTitle className="text-xl font-bold">
                Course Version {versionData?.version}
              </CardTitle>
            </div>
            <CardDescription className="text-pretty">
              {versionData?.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ListChecks className="w-4 h-4" />
                  Total Items: {versionData?.totalItems}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CalendarDays className="w-4 h-4 mt-1 text-muted-foreground" />
                  <div className="leading-tight">
                    <span className="block">Created On</span>
                    <span className="font-medium text-foreground">
                      {formatDate(versionData?.createdAt?.toString())}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CalendarDays className="w-4 h-4 mt-1 text-muted-foreground" />
                  <div className="leading-tight">
                    <span className="block">Last Updated</span>
                    <span className="font-medium text-foreground">
                      {formatDate(versionData?.updatedAt?.toString())}
                    </span>
                  </div>
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
                  <Button className="w-full flex items-center justify-center gap-2" disabled={isFormFieldsLoading}>
                    {isFormFieldsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Begin Registration
                      </>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className=" p-6 pb-1 "
                  style={{ height: '80vh' }}
                >
                  <DialogHeader className="mb-4">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-xl sm:text-2xl font-semibold">
                        Course Registration Form
                      </DialogTitle>
                    </div>
                  </DialogHeader>

                  <ScrollArea className="h-[calc(80vh-80px)] px-4">
                    {isFormFieldsLoading ? (
                      <div className="text-center text-muted-foreground py-8">
                        Loading form fields...
                      </div>
                    ) : !jsonSchema?.properties ? (
                      <div className="text-center text-muted-foreground py-8">
                        No form fields available.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Form
                          schema={jsonSchema}
                          validator={validator}
                          uiSchema={uiSchema}
                          onSubmit={onSubmit}
                          disabled={isSubmitting}
                        />
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>

              </Dialog>
            </section>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <NotebookText className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Modules</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Lessons included in this version
            </p>
          </div>
          {/* <Button 
          variant="outline" 
          onClick={() => setShowModules(s => !s)}
          className="flex items-center gap-2"
        >
          {showModules ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide lessons
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              View lessons
            </>
          )}
        </Button> */}
        </div>
        {/* {showModules && (
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
        )} */}

        {versionData !== null ? (
          <>
            <ScrollArea className="h-52 pr-2">
              <Accordion
                type="single"
                collapsible
                className="mt-4 space-y-4"
              >
                {(versionData?.modules ?? []).map((m, idx) => {
                  const id = (m as any)._id ?? (m as any).title ?? idx.toString();

                  return (
                    <AccordionItem
                      key={id}
                      value={id}
                    >
                      <AccordionTrigger className="px-4 py-3">
                        <div className="flex gap-3 text-left items-center">
                          <span
                            className="inline-flex h-7 w-7 items-center border rounded-full justify-center text-xs font-medium text-muted-foreground"
                            aria-hidden="true"
                          >
                            {idx + 1}
                          </span>

                          <div className='flex gap-3 items-center'>
                            <p className="font-semibold">
                              {(m as any).title ?? (m as any).name}
                            </p>
                              <Badge variant="outline">
                                {((m as any).itemsCount ?? 0).toString()} items
                              </Badge>
                          </div>

                        </div>
                      </AccordionTrigger>

                      <AccordionContent>
                        <div className="px-4 pb-4">
                          {(m as any).description ? (
                            <p className="text-sm text-muted-foreground">
                              {(m as any).description}
                            </p>
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </ScrollArea>
          </>
        ) : (
          <>
            <p>No modules found</p>
          </>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Instructors</h2>
          </div>
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
                    <span className="font-medium flex items-center gap-1 ">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
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