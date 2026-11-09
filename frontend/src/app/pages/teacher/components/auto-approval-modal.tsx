import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Settings, Mail, Plus, X } from "lucide-react";
import { useUpdateAutoApprovalsettings } from "@/hooks/hooks";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

type AutoApprovalMode = "EVERYONE" | "LIST";

interface AutoApprovalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  currentSettings?: {
    registrationsAutoApproved?: boolean;
    autoapproval_emails?: string[];
    autoApprovalMode?: AutoApprovalMode;
    cohortSettingDetails?: any[];
  };
  courseVersion: any;
}

export default function AutoApprovalModal({ 
  isOpen, 
  onOpenChange, 
  versionId,
  currentSettings,
  courseVersion,
}: AutoApprovalModalProps) {
  const [isAutoApproved, setIsAutoApproved] = useState(false);
  const [mode, setMode] = useState<AutoApprovalMode>("EVERYONE");
  const [emailPatterns, setEmailPatterns] = useState<string[]>([]);
  const [newEmailPattern, setNewEmailPattern] = useState("");
  const [isUpdating,setIsUpdating]=useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { mutateAsync:updateAutoApprovalSettings } = useUpdateAutoApprovalsettings(versionId);
  const [cohort, setCohort] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSettings) return;

    if (cohort && currentSettings?.cohortSettingDetails?.length) {
      const setting = currentSettings?.cohortSettingDetails?.find(
        (c) => c.cohortId === cohort
      );

      setIsAutoApproved(setting?.registrationsAutoApproved ?? false);
      setMode(setting?.autoApprovalMode ?? "EVERYONE");
      setEmailPatterns(setting?.autoapproval_emails ?? []);
    } else {
      setIsAutoApproved(currentSettings.registrationsAutoApproved ?? false);
      setMode(currentSettings.autoApprovalMode ?? "EVERYONE");
      setEmailPatterns(currentSettings.autoapproval_emails ?? []);
    }
  }, [cohort, currentSettings]);

  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      setCohort(null);    }
  }, [isOpen]);


  const addEmailPattern = () => {
    if (newEmailPattern.trim() && !emailPatterns.includes(newEmailPattern.trim())) {
      setEmailPatterns([...emailPatterns, newEmailPattern.trim()]);
      setNewEmailPattern("");
    }
  };

  const removeEmailPattern = (pattern: string) => {
    setEmailPatterns(emailPatterns.filter(p => p !== pattern));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmailPattern();
    }
  };

  const handleSave = async () => {
    if(courseVersion?.cohorts?.length > 0 && !cohort){
      toast.error("Please select a cohort before saving settings.");
      return;
    }
    setIsUpdating(true);
    setSaveError(null);
    try {
      await updateAutoApprovalSettings({
        registrationsAutoApproved: isAutoApproved,
        autoApprovalMode: mode,
        autoapproval_emails: mode === "LIST" ? emailPatterns : [],
        cohortId: cohort || undefined,
      });
      toast.success('Auto-approval settings updated successfully');
      setIsUpdating(false);
      onOpenChange(false);
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating auto-approval settings:', error);
      // Shown in the modal: a toast would sit behind the dialog's overlay. A
      // rejected entry comes back with a message naming it.
      setSaveError((error as any)?.message || 'Failed to update auto-approval settings');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configure Auto Approval
          </DialogTitle>
        </DialogHeader>

        {courseVersion?.cohorts?.length > 0 && (
          <div>
            <DropdownMenu>
              <span className="mr-4">Cohort Name:</span>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="mt-2 px-3 py-2 text-sm w-[30%]"
                >
                   {cohort ? courseVersion.cohortDetails.find(c => c.id === cohort)?.name : "Select Cohort"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup
                  value={cohort ?? ""}
                  onValueChange={(value) => {
                    setCohort(value);
                  }}
                >
                  {courseVersion?.cohortDetails?.map((cohort) => (
                    <DropdownMenuRadioItem
                      key={cohort.id}
                      value={cohort.id}
                    >
                      {cohort.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}
      {(
        !courseVersion?.cohortDetails?.length ||
        cohort
      ) && (
        <div className="space-y-6 mt-6">
          {/* Auto-approval toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-approval" className="text-sm font-medium">
                Enable Auto Approval
              </Label>
              <p className="text-xs text-muted-foreground">
                Approved students are enrolled straight away and get an email
              </p>
            </div>
            <Switch
              id="auto-approval"
              checked={isAutoApproved}
              onCheckedChange={setIsAutoApproved}
            />
          </div>

          {/* Who is approved */}
          {isAutoApproved && (
            <div className="space-y-2">
              <Label id="auto-approval-mode" className="text-sm font-medium">
                Who is approved
              </Label>
              <RadioGroup
                aria-labelledby="auto-approval-mode"
                value={mode}
                onValueChange={(value) => setMode(value as AutoApprovalMode)}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="EVERYONE" id="auto-approval-everyone" />
                  <Label htmlFor="auto-approval-everyone" className="text-sm font-normal">
                    Everyone
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="LIST" id="auto-approval-list" />
                  <Label htmlFor="auto-approval-list" className="text-sm font-normal">
                    Only these emails
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Email patterns */}
          {isAutoApproved && mode === "LIST" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Emails and domains
                </Label>
                <p className="text-xs text-muted-foreground">
                  A full address matches only that address. A domain such as iitm.ac.in matches only that domain, not its subdomains. Anyone else waits for you.
                </p>
              </div>

              {/* Add new pattern */}
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., iitm.ac.in or student@example.com"
                  value={newEmailPattern}
                  onChange={(e) => setNewEmailPattern(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmailPattern}
                  disabled={!newEmailPattern.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Existing patterns */}
              {emailPatterns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emailPatterns.map((pattern) => (
                    <Badge
                      key={pattern}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {pattern}
                      <button
                        onClick={() => removeEmailPattern(pattern)}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {emailPatterns.length === 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">No emails or domains added</span>
                  </div>
                  Nobody will be approved automatically until you add one.
                </div>
              )}
            </div>
          )}
        </div>
      )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive mt-4">
            {saveError}
          </p>
        )}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating}
          >
            {isUpdating ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
