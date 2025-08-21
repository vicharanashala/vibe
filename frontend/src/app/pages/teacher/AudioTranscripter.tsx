import { AudioManager } from "@/components/ai/WhisperManager";
import { Button } from "@/components/ui/button";
import { useTranscriber } from "@/hooks/useTranscriber";
import { useEffect, useState } from "react";


interface IAudioTranscripter {
    onSave:(currentText: string) => void
    setFinalTranscript:(transcript: string) => void
}

// Validation
export function validateTranscript(text: string): string | null {
    if (!text.trim()) {
        return "Transcript cannot be empty.";
    }
    if (text.length < 5) {
        return "Transcript must be at least 5 characters long.";
    }
    return null;
}

export const AudioTranscripter = (props:IAudioTranscripter) => {

    const transcriber = useTranscriber();
    const [isEditing, setIsEditing] = useState(false);

    const [transcriptText, setTranscriptText] = useState("");
    const [prevTranscript, setPrevTranscript] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (transcriber.output?.text) {
            const transcribedText = transcriber.output?.text
            props.setFinalTranscript(transcribedText);
            setTranscriptText(transcribedText);
            setPrevTranscript(transcribedText);
        }
    }, [transcriber.output?.text]);


      const handleSave = () => {
        const currentText = transcriptText;
        const errorMsg = validateTranscript(transcriptText);

        if (errorMsg) {
            setTranscriptText(prevTranscript);
            setError(errorMsg);
            return;
        }
        
        setError("");
        setPrevTranscript(currentText);
        props.onSave(currentText)
        setIsEditing(false);
      };

      return (
        <div className="flex justify-center items-start py-10 ">
            <div className="w-full max-w-3xl flex flex-col items-center gap-6">

                <AudioManager transcriber={transcriber} />

                {transcriber.output?.text && (
                    <div className="w-full bg-white dark:bg-card/50 border border-gray-200 dark:border-border rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transcription Result</h3>
                                {transcriber.isBusy && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                )}
                            </div>

                            {!transcriber.isBusy && (
                                <Button
                                    onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                                    className="
                                        py-1.5 text-sm font-medium rounded-lg bg-transparent hover:bg-transparent px-5 border border-blue-500 text-blue-600
                                        hover:border-blue-600 hover:text-blue-700
                                        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                                        shadow-sm hover:shadow-md transition-all"
                                    >
                                    {isEditing ? "Save" : "Edit"}
                                </Button>
                            )}
                        </div>

                        <div className="min-h-[200px]">
                            {isEditing ? (
                            <>
                                <textarea
                                    value={transcriptText}
                                    onChange={(e) =>{
                                            const value = e.target.value
                                            setError("");
                                            setTranscriptText(value)
                                        }}
                                    className="w-full h-[200px] p-3 text-base leading-relaxed text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                                    placeholder="Edit your transcription here..."
                                />
                                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                            </>
                            ) : (
                            <div className="w-full h-[200px] p-3 text-base leading-relaxed text-gray-800 dark:text-gray-100 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto">
                                <p className="whitespace-pre-wrap">{transcriptText}</p>
                            </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

}