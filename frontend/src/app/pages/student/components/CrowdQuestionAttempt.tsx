import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface CrowdQuestionAttemptProps {
  question: any; // Replace with your question type
  onSubmit: (answer: any) => Promise<void>;
}

const CrowdQuestionAttempt: React.FC<CrowdQuestionAttemptProps> = ({ question, onSubmit }) => {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!question) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(selectedOption);
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <Card className="my-4">
      <CardContent>
        <h3 className="font-semibold mb-2">Crowdsourced Question (Ungraded)</h3>
        <div className="mb-2">{question.text}</div>
        <div className="flex flex-col gap-2 mb-4">
          {question.options?.map((opt: string, idx: number) => (
            <label key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="crowd-question-option"
                value={opt}
                checked={selectedOption === opt}
                onChange={() => setSelectedOption(opt)}
                disabled={submitting || submitted}
              />
              {opt}
            </label>
          ))}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!selectedOption || submitting || submitted}
        >
          {submitted ? "Submitted" : submitting ? "Submitting..." : "Submit Attempt"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CrowdQuestionAttempt;
