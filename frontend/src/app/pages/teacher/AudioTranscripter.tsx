import { AudioManager } from "@/components/ai/WhisperManager";
import { Button } from "@/components/ui/button";
import { TranscriberData, useTranscriber } from "@/hooks/useTranscriber";
import { useEffect, useState } from "react";
import { TranscriptionResult } from "./components/TranscriptionResult";


interface IAudioTranscripter {
    transcribedData: TranscriberData | undefined;
    setTranscribedData:(transcript: TranscriberData | undefined) => void;
    setIsTranscribing: (value: boolean) => void;
    setIsAudioExtracting: (value: boolean) => void;
    isRunningAiJob: boolean;
    isCreatingAiJob: boolean;
    jobError: string;
    createAiJob: () => void
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

        transcriber.isBusy ?  props.setIsTranscribing(true): props.setIsTranscribing(false);
        transcriber.isModelLoading ?  props.setIsAudioExtracting(true): props.setIsAudioExtracting(false);

        if (transcriber.output?.text) {
            props.setTranscribedData(transcriber.output);

            const transcribedText = transcriber.output?.text
            setTranscriptText(transcribedText);
            setPrevTranscript(transcribedText);
        }

    }, [transcriber.output, transcriber.isBusy, transcriber.isModelLoading]);

    const handleSave = (editedText?: string) => {
        const currentText = editedText || transcriptText;
        const errorMsg = validateTranscript(currentText);

        if (errorMsg) {
            setTranscriptText(prevTranscript);
            setError(errorMsg);
            return;
        }

        setError("");
        setPrevTranscript(currentText);

        const originalChunks = props.transcribedData?.chunks ?? [];
        const totalLength = originalChunks.reduce((sum, c) => sum + c.text.length, 0);

        const newChunks = originalChunks.map((chunk) => {
            const proportion = chunk.text.length / totalLength;
            const newChunkLength = Math.round(currentText.length * proportion);
            const startIndex = originalChunks
                .slice(0, originalChunks.indexOf(chunk))
                .reduce((sum, c) => sum + Math.round(currentText.length * (c.text.length / totalLength)), 0);

            const newChunkText = currentText.slice(startIndex, startIndex + newChunkLength);
            return {
                ...chunk,
                text: newChunkText
            };
        });

        props.setTranscribedData({
            text: currentText,
            isBusy: props.transcribedData?.isBusy ?? false,
            chunks: newChunks,
        });

        setIsEditing(false);
    };


      return (
        <div className="flex justify-center items-start py-10 ">
            <div className={`w-full ${!transcriber.output?.text && "max-w-3xl"} flex flex-col items-center gap-6`}>
                {transcriber.output?.text && (
                    <div className="w-full">
                      <TranscriptionResult 
                        transcription={transcriptText} 
                        isEditing={isEditing} 
                        setIsEditing={setIsEditing}  
                        onTranscriptionUpdate={handleSave} 
                        isProcessing={transcriber.isBusy}
                        isRunningAiJob={props.isRunningAiJob}
                        tooltipContent={"Converts extracted audio into accurate text transcripts."}
                      />
                    </div>
                )}
                <AudioManager 
                    transcriber={transcriber} 
                    // isDisableButton={
                    // (transcriber.output?.text && !props.isRunningAiJob && !props.isCreatingAiJob) ? false : 
                    // (!!transcriber.output?.text || props.isRunningAiJob || transcriber.isBusy)
                    // } 
                    isEditingTranscription={isEditing}
                    jobError = {props.jobError}
                    createAiJob = {props.createAiJob}
                    isCreatingAiJob = {props.isCreatingAiJob}
                    isRunningAiJob={props.isRunningAiJob}
                />
                 
            </div>
        </div>
    )

}