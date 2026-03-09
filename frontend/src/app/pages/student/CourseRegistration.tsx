import {  router, studentCourseInviteRegistration } from '@/app/routes/router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Form from "@rjsf/shadcn";
import { useGetCourseRegistration, useGetDynamicFields, useSubmitCourseRegistration } from '@/hooks/hooks';
import { useParams } from '@tanstack/react-router';
import React, { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from 'sonner';
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, CalendarDays, ChevronDown, ChevronUp, GraduationCap, ListChecks, Loader2, NotebookText, UserPlus, Users } from 'lucide-react';
import { AlignedFieldTemplate } from './components/AlignedFieldTemplate';
import { CustomSubmitButton } from './components/CustomSubmitButton';
import { FocusableSelectWidget } from './components/FocusableSelectWidget';
import { useAuthStore } from '@/store/auth-store';

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
  cohorts: {cohortId: string, cohortName: string}[];
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

export const normalizeSchemaOptions = (schema: any): any => {
  if (!schema || typeof schema !== "object") return schema;

  const clone = { ...schema };

  const toTitle = (str: string) =>
    str
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  if (clone.properties) {
    clone.properties = Object.fromEntries(
      Object.entries(clone.properties).map(([key, value]: any) => {
        let prop = { ...value };

        // enum + oneOf → remove enum
        if (prop.oneOf && prop.enum) {
          delete prop.enum;
        }

        // enum only → convert to oneOf
        if (!prop.oneOf && prop.enum) {
          prop.oneOf = prop.enum.map((val: string) => ({
            const: val,
            title: toTitle(val),
          }));
          delete prop.enum;
        }

        //not adding empty option
        if (prop.oneOf) {
          prop["ui:placeholder"] = "Select an option";
          prop["ui:emptyValue"] = undefined;
        }

        return [key, normalizeSchemaOptions(prop)];
      })
    );
  }

  return clone;
};



const CourseRegistration: React.FC = () => {
  const { cohort, versionId } = studentCourseInviteRegistration.useParams();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const isRecaptchaEnabled: boolean = import.meta.env.VITE_IS_RECAPTCHA_ENABLED === "true";
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

      let body: any = { ...data.formData, recaptchaToken: isRecaptchaEnabled ? recaptchaToken : "NO_CAPTCHA" };
      if (cohort) {
        body.cohort = cohort;
      }

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
        if (recaptchaToken && isRecaptchaEnabled) {
          formDataObj.append('recaptchaToken', recaptchaToken);
        }
        else {
          formDataObj.append('recaptchaToken', "NO_CAPTCHA")
        }
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


      setIsRegistering(false);
      setIsRegistered(true)
      setFormData(buildEmptyFormData(jsonSchema!));

    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong, please try again.');
      if(err?.message.includes("You are already enrolled")){
        console.log("err?.message----",err?.message);
        setTimeout(() => {
          router.navigate({ to: '/student' });
        }, 1000);
      }
    }
  };

 const resetForm = () => {
  if (jsonSchema) {
    const empty = buildEmptyFormData(jsonSchema);

    setFormData({
      ...empty,
      Name: user?.name,
      Email: user?.email,
    });
  }

  setRecaptchaToken(null);
  recaptchaRef.current?.reset();
};

  const buildEmptyFormData = (schema: RJSFSchema) => {
    if (!schema?.properties) return {};

    const obj: Record<string, any> = {};

    Object.entries(schema.properties).forEach(([key, prop]: any) => {
      if (prop.type === "boolean") {
        obj[key] = false;            // checkbox unchecked
      } else {
        obj[key] = undefined;        // prevents enum auto-select
      }
    });

    return obj;
  };



 useEffect(() => {
  if (!jsonSchema?.properties||!user) return;

  const emptyData = buildEmptyFormData(jsonSchema);

  setFormData(prev => ({
    ...emptyData,
    Name: user?.name ?? "emptyData.Name",
    Email: user?.email ?? "emptyData.Email",
  }));
}, [jsonSchema, user]);



const computedUiSchema = React.useMemo(() => {
  if (!uiSchema) return uiSchema;

  return {
    ...uiSchema,
    Name: {
      ...uiSchema?.Name,
      "ui:disabled": true,
    },
    Email: {
      ...uiSchema?.Email,
      "ui:disabled": true,
    },
  };
}, [uiSchema]);


  useEffect(() => { setIsRegistered(false) }, [])






  if (isLoadingVersionData) {
    return (
      <div className="min-h-screen flex  justify-center px-6  my-8">
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
    <main className="mx-auto max-w-5xl space-y-8 my-8">
      <header className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
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
        <section className="space-y-4">
          {/* Registration Section */}
          {!isRegistering && !isRegistered ? (
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
                  {cohort && 
                  <CardTitle className="text-xl font-bold">
                    Cohort {versionData?.cohorts?.find(c => c.cohortId === cohort)?.cohortName}
                  </CardTitle>}
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

                  <Button
                    onClick={() => {
                      setIsRegistering(true);
                      resetForm();
                    }}
                    className="w-full flex items-center justify-center gap-2"
                    disabled={isFormFieldsLoading}
                  >
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
                </section>
              </CardContent>
            </Card>
          ) : !isRegistered ? (
            <Card className="w-full border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">
                  Course Registration Form
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsRegistering(false)}>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </CardHeader>
              <CardContent>
                {isFormFieldsLoading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading form fields...
                  </div>
                ) : !jsonSchema?.properties ? (
                  <div className="text-center text-muted-foreground py-8">
                    No form fields available.
                  </div>
                ) : (
                  <div className="space-y-4 max-w-2xl mx-auto py-4">
                    <Form
                     
                      schema={normalizeSchemaOptions(jsonSchema)}
                      validator={validator}
                     uiSchema={computedUiSchema}
                      formContext={{ formData }}
                      showErrorList={false}
                      templates={{
                        FieldTemplate: AlignedFieldTemplate,
                        ButtonTemplates: {
                          SubmitButton: CustomSubmitButton,
                        },
                      }}
                      onError={(errors) => {
                        setSubmitErrors(errors.map(e => e.stack));
                      }}
                      widgets={{
                        SelectWidget: FocusableSelectWidget,
                      }}
                      onSubmit={onSubmit}
                      formData={formData}
                      onChange={(e) => setFormData(e.formData)}
                    // disabled={isSubmitting}
                    >
                      <div className="flex flex-col items-center justify-center mt-6 mb-6 gap-4">
                        {isRecaptchaEnabled && (
                          <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            theme="dark"
                            onChange={(token) => setRecaptchaToken(token)}
                          />
                        )}

                        {versionId === "6981df886e100cfe04f9c4ae" && (
                          <a
                            href="https://chat.whatsapp.com/C9rNZGk2QM66A1SFsA0cP4"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
      w-full
      flex items-center justify-between
      rounded-lg border border-green-200 dark:border-green-800
      bg-white/70 dark:bg-green-950/20
      px-4 py-3
      text-green-900 dark:text-green-100
      hover:bg-green-50/70 dark:hover:bg-green-950/35
      transition
    "
                          >
                            <span className="flex items-center gap-3">
                              {/* WhatsApp icon (fixed size) */}
                              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-green-500">
                                <svg
                                  className="w-5 h-5 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </span>

                              {/* Text */}
                              <span className="flex flex-col leading-tight">
                                <span className="text-base sm:text-lg font-semibold">
                                  Join our WhatsApp channel
                                </span>
                                <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">
                                  Join to receive updates and  support                                </span>
                              </span>
                            </span>

                            {/* Arrow */}
                            <svg
                              className="w-5 h-5 text-green-700 dark:text-green-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}

                        {submitErrors.length > 0 && (
                          <div className="w-full rounded-md border border-red-200 bg-red-50 p-3">
                            <p className="text-sm font-medium text-red-600 mb-1">
                              Please fix the following:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                              {submitErrors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {formFieldData && (formFieldData as any).isActive === false && (
                          <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-4 mb-4">
                            <div className="flex gap-3">
                              <div className="text-amber-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-amber-800">Registration Closed</h3>
                                <p className="mt-1 text-sm text-amber-700">
                                  This course is not currently accepting new registrations.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        <Button
                          type="submit"
                          disabled={isSubmitting || (!recaptchaToken && isRecaptchaEnabled) || (formFieldData as any)?.isActive === false}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Registering...
                            </>
                          ) : (
                            'Submit Registration'
                          )}
                        </Button>
                      </div>
                    </Form>

                    {/* 🔥 Hardcoded CTA link AFTER form */}

                  </div>

                )}
              </CardContent>
            </Card>
          ) : (
            <>

              <Card className="w-full max-w-3xl mx-auto border border-green-300 dark:border-green-700 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="text-center space-y-2 pb-2">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <GraduationCap className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>

                  <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
                     Registration Request Submitted 🎉
                  </CardTitle>

                  <CardDescription className="text-base">
                      Your enrollment request has been successfully submitted.
                  </CardDescription>

                   <p className="text-sm text-muted-foreground max-w-md mx-auto text-center">
                      Our team will review your request and notify you once it is approved.
                    </p>
                </CardHeader>

                <CardContent className="space-y-1 text-center py-3">
                  <div className="flex flex-col items-center justify-center gap-1 pt-2">
                   <Button
                      onClick={() => window.location.href = "/student"}
                      className="flex items-center gap-2 px-6 py-4 text-base"
                      >
                      <BookOpen className="w-5 h-5" />
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>

              </Card>
            </>)}
        </section>
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

        </div>

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

