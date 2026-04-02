import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Shield, Clock, CheckCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateEjectionPolicy, useUpdateEjectionPolicy } from "@/hooks/ejection-policy-hooks";
import { EjectionPolicy, PolicyScope } from "@/types/ejection-policy.types";

interface EjectionPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  editPolicy?: EjectionPolicy | null;
  defaultScope?: string | null;
  courseId?: string;
  courseVersionId?:string,
  cohortId?: string; 
  courseName?: string;
  isAdmin: boolean;
}

export const EjectionPolicyModal = ({
  isOpen,
  onClose,
  editPolicy,
  defaultScope = PolicyScope.PLATFORM,
  courseId,
  courseVersionId,
  cohortId,
  courseName,
  isAdmin,
}: EjectionPolicyModalProps) => {
  const createPolicy = useCreateEjectionPolicy();
  const updatePolicy = useUpdateEjectionPolicy();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    
    courseId: defaultScope === PolicyScope.COURSE ? courseId || "" : "",
    courseVersionId: defaultScope === PolicyScope.COURSE ? courseVersionId || "" : "",
    cohortId: cohortId ||"",
    isActive: true,
    
    // Triggers
    inactivityEnabled: false,
    inactivityThresholdDays: 30,
    inactivityWarningDays: 7,
    
    missedDeadlinesEnabled: false,
    consecutiveMisses: 3,
    warningAfterMisses: 2,
    progressRules: [] as { timeframeDays: number; targetPercentage: number }[],
    
    violationsEnabled: false,
    violationTypes: [] as string[],
    violationThresholdCount: 3,
    violationOtherDescription: "",

    // Anomaly Detection
    anomalyEnabled: false,
    anomalyThresholdScore: 80,
    anomalyWarningScore: 60,
    
    // Actions
    sendWarning: true,
    warningTemplate: "",
    ejectionTemplate: "",
    allowAppeal: true,
    appealDeadlineDays: 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load edit data
  useEffect(() => {
    if (editPolicy) {
      setFormData({
        name: editPolicy.name,
        description: editPolicy.description || "",
        
        courseId: editPolicy.courseId || "",
        courseVersionId: editPolicy.courseVersionId || "",
        cohortId: editPolicy.cohortId || "",
        
        isActive: editPolicy.isActive,
        
        inactivityEnabled: editPolicy.triggers.inactivity?.enabled || false,
        inactivityThresholdDays: editPolicy.triggers.inactivity?.thresholdDays || 30,
        inactivityWarningDays: editPolicy.triggers.inactivity?.warningDays || 7,
        
        missedDeadlinesEnabled: editPolicy.triggers.missedDeadlines?.enabled || false,
        consecutiveMisses: editPolicy.triggers.missedDeadlines?.consecutiveMisses || 3,
        warningAfterMisses: editPolicy.triggers.missedDeadlines?.warningAfterMisses || 2,
        progressRules: editPolicy.triggers.missedDeadlines?.progressRules || [],
        
        violationsEnabled: editPolicy.triggers.policyViolations?.enabled || false,
        violationTypes: [
          ...(editPolicy.triggers.policyViolations?.violations?.predefined || []),
          ...(editPolicy.triggers.policyViolations?.violations?.custom?.length
            ? ["other"]
            : []),
        ],
        violationOtherDescription:
          editPolicy.triggers.policyViolations?.violations?.custom?.[0] || "",
        violationThresholdCount: editPolicy.triggers.policyViolations?.thresholdCount || 3,

        anomalyEnabled: editPolicy.triggers.anomalyDetection?.enabled || false,
        anomalyThresholdScore: editPolicy.triggers.anomalyDetection?.thresholdScore || 80,
        anomalyWarningScore: editPolicy.triggers.anomalyDetection?.warningScore || 60,
          
        sendWarning: editPolicy.actions.sendWarning,
        warningTemplate: editPolicy.actions.warningTemplate || "",
        ejectionTemplate: editPolicy.actions.ejectionTemplate || "",
        allowAppeal: editPolicy.actions.allowAppeal,
        appealDeadlineDays: editPolicy.actions.appealDeadlineDays || 5,
      });
    } else {
      // Reset for create mode
      setFormData({
        name: "",
        description: "",
        
        courseId: courseId || "",
        courseVersionId: courseVersionId || "",
        cohortId: cohortId || "",
        
        isActive: true,
        inactivityEnabled: false,
        inactivityThresholdDays: 30,
        inactivityWarningDays: 7,
        missedDeadlinesEnabled: false,
        consecutiveMisses: 3,
        warningAfterMisses: 2,
        progressRules: [],
        violationsEnabled: false,
        violationTypes: [] as string[],
        violationOtherDescription: "",
        violationThresholdCount: 3,
        anomalyEnabled:false,
        anomalyThresholdScore:80,
        anomalyWarningScore:60,
        sendWarning: true,
        warningTemplate: "",
        ejectionTemplate: "",
        allowAppeal: true,
        appealDeadlineDays: 5,
      });
    }
    setErrors({});
  }, [editPolicy, defaultScope, courseId, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Policy name is required";
    }

    

    // At least one trigger must be enabled
    if (!formData.inactivityEnabled && !formData.missedDeadlinesEnabled && !formData.violationsEnabled && !formData.anomalyEnabled) {
      newErrors.triggers = "At least one trigger must be enabled";
    }

    // Validate inactivity trigger
    if (formData.inactivityEnabled) {
      if (formData.inactivityThresholdDays <= 0) {
        newErrors.inactivityThreshold = "Threshold must be greater than 0";
      }
      if (formData.inactivityWarningDays < 0) {
        newErrors.inactivityWarning = "Warning days cannot be negative";
      }
      if (formData.inactivityWarningDays >= formData.inactivityThresholdDays) {
        newErrors.inactivityWarning = "Warning days must be less than threshold days";
      }
    }

    // Validate missed deadlines trigger
    if (formData.missedDeadlinesEnabled) {
      if (formData.consecutiveMisses <= 0) {
        newErrors.consecutiveMisses = "Consecutive misses must be greater than 0";
      }
      if (formData.warningAfterMisses < 0) {
        newErrors.warningAfterMisses = "Warning threshold cannot be negative";
      }
      if (formData.warningAfterMisses >= formData.consecutiveMisses) {
        newErrors.warningAfterMisses = "Warning threshold must be less than ejection threshold";
      }
      if (formData.progressRules.length === 0) {
        newErrors.missedDeadlinesRules = "At least one progress rule is required";
      }
      formData.progressRules.forEach((rule, idx) => {
        if (rule.timeframeDays <= 0) {
          newErrors[`progressRuleTimeframe_${idx}`] = "Days must be > 0";
        }
        if (rule.targetPercentage < 0 || rule.targetPercentage > 100) {
          newErrors[`progressRuleTarget_${idx}`] = "Percentage must be 0-100";
        }
      });
    }

    // Validate violations trigger
    if (formData.violationsEnabled) {
      if (formData.violationTypes.length === 0) {
        newErrors.violationTypes = "At least one violation type must be selected";
      }
      if (formData.violationTypes.includes("other") && !formData.violationOtherDescription.trim()) {
    newErrors.violationOther = "Please describe the 'other' violation";
  }
      if (formData.violationThresholdCount <= 0) {
        newErrors.violationThreshold = "Violation threshold must be greater than 0";
      }
    }

    if (formData.anomalyEnabled) {
      if (formData.anomalyThresholdScore <= 0) {
        newErrors.anomalyThreshold = "Threshold score must be greater than 0";
      }

      if (
        formData.anomalyWarningScore >= formData.anomalyThresholdScore
      ) {
        newErrors.anomalyWarning =
          "Warning score must be less than threshold score";
      }
    }

    // Validate appeal deadline
    if (formData.allowAppeal && (!formData.appealDeadlineDays || formData.appealDeadlineDays <= 0)) {
      newErrors.appealDeadline = "Appeal deadline must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    try {
      const policyData = {
        name: formData.name,
        description: formData.description,
        courseId: formData.courseId,
        courseVersionId: formData.courseVersionId ,
        cohortId: formData.cohortId, 
       
        isActive: formData.isActive,
        triggers: {
          inactivity: formData.inactivityEnabled ? {
            enabled: true,
            thresholdDays: formData.inactivityThresholdDays,
            warningDays: formData.inactivityWarningDays,
          } : null,
          missedDeadlines: formData.missedDeadlinesEnabled ? {
            enabled: true,
            consecutiveMisses: formData.consecutiveMisses,
            warningAfterMisses: formData.warningAfterMisses,
            progressRules: formData.progressRules,
          } : null,
          policyViolations: formData.violationsEnabled ? {
            enabled: true,
            violations: {
              predefined: formData.violationTypes.filter(t => t !== "other"),
              custom: formData.violationTypes.includes("other")
                ? [formData.violationOtherDescription]
                : [],
            },
            thresholdCount: formData.violationThresholdCount,
          } : null,
          anomalyDetection: formData.anomalyEnabled ? {
            enabled: true,
            thresholdScore: formData.anomalyThresholdScore,
            warningScore: formData.anomalyWarningScore,
          } : null,
          customTriggers: null,
        },
        actions: {
          sendWarning: formData.sendWarning,
          warningTemplate: formData.warningTemplate || null,
          ejectionTemplate: formData.ejectionTemplate || null,
          allowAppeal: formData.allowAppeal,
          appealDeadlineDays: formData.allowAppeal ? formData.appealDeadlineDays : null,
          autoReinstatementRules: null,
        },
      };

      if (editPolicy) {
        await updatePolicy.mutateAsync({
          params: { path: { policyId: editPolicy._id } },
          body: policyData,
        });
        toast.success("Policy updated successfully");
      } else {
        await createPolicy.mutateAsync({ body: policyData });
        toast.success("Policy created successfully");
      }

      onClose();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${editPolicy ? 'update' : 'create'} policy`);
    }
  };

  const isPending = createPolicy.isPending || updatePolicy.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {editPolicy ? "Edit Policy" : "Create Course Policy"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              Basic Information
            </h3>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Policy Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Platform Inactivity Policy"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this policy does..."
                  rows={3}
                />
              </div>

              <div className="">
                

               
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="isActive" className="cursor-pointer">Active Status</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Triggers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <div className="w-1 h-4 bg-orange-500 rounded-full" />
                Ejection Triggers
              </h3>
              {errors.triggers && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errors.triggers}
                </Badge>
              )}
            </div>

            {/* Inactivity Trigger */}
            {/* <Card className={formData.inactivityEnabled ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <Label htmlFor="inactivityEnabled" className="cursor-pointer font-medium">
                      Inactivity Trigger
                    </Label>
                  </div>
                  <Switch
                    id="inactivityEnabled"
                    checked={formData.inactivityEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, inactivityEnabled: checked })}
                  />
                </div>

                {formData.inactivityEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <Label htmlFor="thresholdDays" className="text-xs">Threshold (days) *</Label>
                      <Input
                        id="thresholdDays"
                        type="number"
                        value={formData.inactivityThresholdDays}
                        onChange={(e) => setFormData({ ...formData, inactivityThresholdDays: parseInt(e.target.value) || 0 })}
                        min={1}
                        className={errors.inactivityThreshold ? "border-destructive" : ""}
                      />
                      {errors.inactivityThreshold && (
                        <p className="text-xs text-destructive mt-1">{errors.inactivityThreshold}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="warningDays" className="text-xs">Warning (days before) *</Label>
                      <Input
                        id="warningDays"
                        type="number"
                        value={formData.inactivityWarningDays}
                        onChange={(e) => setFormData({ ...formData, inactivityWarningDays: parseInt(e.target.value) || 0 })}
                        min={0}
                        className={errors.inactivityWarning ? "border-destructive" : ""}
                      />
                      {errors.inactivityWarning && (
                        <p className="text-xs text-destructive mt-1">{errors.inactivityWarning}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card> */}

            {/* Missed Deadlines Trigger */}
            <Card className={formData.missedDeadlinesEnabled ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <Label htmlFor="missedDeadlinesEnabled" className="cursor-pointer font-medium">
                      Missed Deadlines Trigger
                    </Label>
                  </div>
                  <Switch
                    id="missedDeadlinesEnabled"
                    checked={formData.missedDeadlinesEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, missedDeadlinesEnabled: checked })}
                  />
                </div>

                {formData.missedDeadlinesEnabled && (
                  <div className="space-y-4 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="consecutiveMisses" className="text-xs">Consecutive Misses *</Label>
                      <Input
                        id="consecutiveMisses"
                        type="number"
                        value={formData.consecutiveMisses}
                        onChange={(e) => setFormData({ ...formData, consecutiveMisses: parseInt(e.target.value) || 0 })}
                        min={1}
                        className={errors.consecutiveMisses ? "border-destructive" : ""}
                      />
                      {errors.consecutiveMisses && (
                        <p className="text-xs text-destructive mt-1">{errors.consecutiveMisses}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="warningAfterMisses" className="text-xs">Warning After (misses) *</Label>
                      <Input
                        id="warningAfterMisses"
                        type="number"
                        value={formData.warningAfterMisses}
                        onChange={(e) => setFormData({ ...formData, warningAfterMisses: parseInt(e.target.value) || 0 })}
                        min={0}
                        className={errors.warningAfterMisses ? "border-destructive" : ""}
                      />
                      {errors.warningAfterMisses && (
                        <p className="text-xs text-destructive mt-1">{errors.warningAfterMisses}</p>
                      )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Dynamic Progress Rules</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setFormData({
                            ...formData,
                            progressRules: [...formData.progressRules, { timeframeDays: 1, targetPercentage: 0 }]
                          })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Rule
                        </Button>
                      </div>
                      
                      {formData.progressRules.length === 0 && (
                        <p className={`text-xs my-2 ${errors.missedDeadlinesRules ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {errors.missedDeadlinesRules || "No progress rules defined. Students will only be evaluated based on misses."}
                        </p>
                      )}
                      
                      {formData.progressRules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2 bg-muted/30 p-2 rounded-md">
                          <div className="flex-1">
                            <Label className="text-xs">Days *</Label>
                            <Input
                              type="number"
                              value={rule.timeframeDays}
                              onChange={(e) => {
                                const updated = [...formData.progressRules];
                                updated[idx].timeframeDays = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, progressRules: updated });
                              }}
                              min={1}
                              className={`h-8 text-sm ${errors[`progressRuleTimeframe_${idx}`] ? "border-destructive" : ""}`}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Required Progress % *</Label>
                            <Input
                              type="number"
                              value={rule.targetPercentage}
                              onChange={(e) => {
                                const updated = [...formData.progressRules];
                                updated[idx].targetPercentage = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, progressRules: updated });
                              }}
                              min={0}
                              max={100}
                              className={`h-8 text-sm ${errors[`progressRuleTarget_${idx}`] ? "border-destructive" : ""}`}
                            />
                          </div>
                          <div className="flex flex-col justify-end h-full pt-4">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                              onClick={() => {
                                const updated = [...formData.progressRules];
                                updated.splice(idx, 1);
                                setFormData({ ...formData, progressRules: updated });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Policy Violations Trigger 
            <Card className={formData.violationsEnabled ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <Label htmlFor="violationsEnabled" className="cursor-pointer font-medium">
                      Policy Violations Trigger
                    </Label>
                  </div>
                  <Switch
                    id="violationsEnabled"
                    checked={formData.violationsEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, violationsEnabled: checked })}
                  />
                </div>

                {formData.violationsEnabled && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <Label className="text-xs">Violation Types *</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {['plagiarism', 'cheating', 'misconduct', 'other'].map((type) => (
  <label key={type} className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={formData.violationTypes.includes(type)}
      onChange={(e) => {
        if (e.target.checked) {
          setFormData({
            ...formData,
            violationTypes: [...formData.violationTypes, type],
          });
        } else {
          setFormData({
            ...formData,
            violationTypes: formData.violationTypes.filter(t => t !== type),
            // ✅ clear description if "other" unchecked
            ...(type === "other" && { violationOtherDescription: "" }),
          });
        }
      }}
      className="rounded"
    />
    <span className="text-sm capitalize">{type}</span>
  </label>
))}
{formData.violationTypes.includes("other") && (
  <div className="mt-3">
    <Label className="text-xs">Describe Other Violation *</Label>
    <Input
      value={formData.violationOtherDescription}
      onChange={(e) =>
        setFormData({
          ...formData,
          violationOtherDescription: e.target.value,
        })
      }
      placeholder="e.g., abusive language, spam behavior..."
      className={errors.violationOther ? "border-destructive" : ""}
    />
    {errors.violationOther && (
      <p className="text-xs text-destructive mt-1">
        {errors.violationOther}
      </p>
    )}
  </div>
)}
                      </div>
                      {errors.violationTypes && (
                        <p className="text-xs text-destructive mt-1">{errors.violationTypes}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="violationThreshold" className="text-xs">Threshold Count *</Label>
                      <Input
                        id="violationThreshold"
                        type="number"
                        value={formData.violationThresholdCount}
                        onChange={(e) => setFormData({ ...formData, violationThresholdCount: parseInt(e.target.value) || 0 })}
                        min={1}
                        className={errors.violationThreshold ? "border-destructive" : ""}
                      />
                      {errors.violationThreshold && (
                        <p className="text-xs text-destructive mt-1">{errors.violationThreshold}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={formData.anomalyEnabled ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-500" />
                    <Label className="cursor-pointer font-medium">
                      Anomaly Detection Trigger
                    </Label>
                  </div>

                  <Switch
                    checked={formData.anomalyEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, anomalyEnabled: checked })
                    }
                  />
                </div>

                {formData.anomalyEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <Label className="text-xs">Threshold Score *</Label>
                      <Input
                        type="number"
                        value={formData.anomalyThresholdScore}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            anomalyThresholdScore: parseInt(e.target.value) || 0,
                          })
                        }
                        min={1}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Warning Score *</Label>
                      <Input
                        type="number"
                        value={formData.anomalyWarningScore}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            anomalyWarningScore: parseInt(e.target.value) || 0,
                          })
                        }
                        min={0}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            */}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-1 h-4 bg-green-500 rounded-full" />
              Policy Actions
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="sendWarning" className="cursor-pointer">Send Warning Notification</Label>
                <Switch
                  id="sendWarning"
                  checked={formData.sendWarning}
                  onCheckedChange={(checked) => setFormData({ ...formData, sendWarning: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="allowAppeal" className="cursor-pointer">Allow Appeals</Label>
                  {formData.allowAppeal && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Students can appeal within {formData.appealDeadlineDays} days
                    </p>
                  )}
                </div>
                <Switch
                  id="allowAppeal"
                  checked={formData.allowAppeal}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowAppeal: checked })}
                />
              </div>

              {formData.allowAppeal && (
                <div>
                  <Label htmlFor="appealDeadline">Appeal Deadline (days) *</Label>
                  <Input
                    id="appealDeadline"
                    type="number"
                    value={formData.appealDeadlineDays}
                    onChange={(e) => setFormData({ ...formData, appealDeadlineDays: parseInt(e.target.value) || 0 })}
                    min={1}
                    className={errors.appealDeadline ? "border-destructive" : ""}
                  />
                  {errors.appealDeadline && (
                    <p className="text-xs text-destructive mt-1">{errors.appealDeadline}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editPolicy ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {editPolicy ? 'Update Policy' : 'Create Policy'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};