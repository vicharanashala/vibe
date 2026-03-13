import { AudioManager } from "@/components/ai/WhisperManager";
import { Button } from "@/components/ui/button";
import { TranscriberData, useTranscriber } from "@/hooks/useTranscriber";
import { useEffect, useRef, useState } from "react";
import { TranscriptionResult } from "./components/TranscriptionResult";


interface IAudioTranscripter {
    transcribedData: TranscriberData | undefined;
    setTranscribedData:(transcript: TranscriberData | undefined) => void;
    setIsTranscribing: (value: boolean) => void;
    setIsAudioExtracting: (value: boolean) => void;
    isRunningAiJob: boolean;
    isCreatingAiJob: boolean;
    isAIModulePage?: boolean;
    jobError: string;
    createAiJob: () => void
    startTimeRef?: React.MutableRefObject<number | null>;
    pauseTimeRef?: React.MutableRefObject<number | null>;
    endTimeRef?: React.MutableRefObject<number | null>;
    startTime?: number | null;
    endTime?: number | null;
    isPaused?: boolean;
    chunkTranscription?: object[];
    setChunkTranscription?: (chunks: object[]) => void;
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

        const isBackgroundTranscribing = useRef<boolean>(true);


    useEffect(() => {

        transcriber.isBusy ?  props.setIsTranscribing(true): props.setIsTranscribing(false);
        transcriber.isModelLoading ?  props.setIsAudioExtracting(true): props.setIsAudioExtracting(false);

        if(!props.isAIModulePage && transcriber.output?.text){
            props.setTranscribedData(transcriber.output);
            const transcribedText = transcriber.output?.text
            setTranscriptText(transcribedText);
            setPrevTranscript(transcribedText);
        }else{

        if (transcriber.output?.text && !isBackgroundTranscribing.current) {
            props.setTranscribedData(transcriber.output);

            const transcribedText = transcriber.output?.text
            setTranscriptText(transcribedText);
            setPrevTranscript(transcribedText);
        }

        }

    }, [transcriber.output, transcriber.isBusy, transcriber.isModelLoading]);

    useEffect(() => {
        if(!props.isAIModulePage) return
  if (!transcriber.isBusy && transcriber.output?.text) {
    console.log("Transcription completed");

    props.createAiJob();
  }
}, [transcriber.isBusy]);

    // const handleSave = (editedText?: string) => {
    //     const currentText = editedText || transcriptText;
    //     const errorMsg = validateTranscript(currentText);

    //     if (errorMsg) {
    //         setTranscriptText(prevTranscript);
    //         setError(errorMsg);
    //         return;
    //     }

    //     setError("");
    //     setPrevTranscript(currentText);

    //     const originalChunks = props.transcribedData?.chunks ?? [];
    //     const totalLength = originalChunks.reduce((sum, c) => sum + c.text.length, 0);

    //     const newChunks = originalChunks.map((chunk) => {
    //         const proportion = chunk.text.length / totalLength;
    //         const newChunkLength = Math.round(currentText.length * proportion);
    //         const startIndex = originalChunks
    //             .slice(0, originalChunks.indexOf(chunk))
    //             .reduce((sum, c) => sum + Math.round(currentText.length * (c.text.length / totalLength)), 0);

    //         const newChunkText = currentText.slice(startIndex, startIndex + newChunkLength);
    //         return {
    //             ...chunk,
    //             text: newChunkText
    //         };
    //     });

    //     props.setTranscribedData({
    //         text: currentText,
    //         isBusy: props.transcribedData?.isBusy ?? false,
    //         chunks: newChunks,
    //     });

    //     setIsEditing(false);
    // };

//     useEffect(() => {
//     if (transcriber.output) {
//         console.log("Whisper Result:", transcriber.output);
//     }
// }, [transcriber.output]);


      return (
        <div className="flex justify-center items-start py-10 ">
            <div className={`w-full ${!transcriber.output?.text && "max-w-3xl"} flex flex-col items-center gap-6`}>
                {transcriber.output?.chunks.length === 0 ? (<p>Transcribe data will showed here...</p>) : ( <div className="w-full">
                      <TranscriptionResult 
                        transcription={transcriptText} 
                        isEditing={isEditing} 
                        setIsEditing={setIsEditing}  
                        isProcessing={transcriber.isBusy}
                        isRunningAiJob={props.isRunningAiJob}
                        tooltipContent={"Converts extracted audio into accurate text transcripts."}
                        startTime={props.startTime}
                        endTime={props.endTime}
                        isAIModulePage={props.isAIModulePage}
                        chunkTranscription={props.chunkTranscription}
                        setChunkTranscription={props.setChunkTranscription}

                      />
                    </div>)}
                <AudioManager 
                    transcriber={transcriber} 
                    isProcessing={transcriber.isBusy}
                    // isDisableButton={
                    // (transcriber.output?.text && !props.isRunningAiJob && !props.isCreatingAiJob) ? false : 
                    // (!!transcriber.output?.text || props.isRunningAiJob || transcriber.isBusy)
                    // } 
                    isEditingTranscription={isEditing}
                    jobError = {props.jobError}
                    createAiJob = {props.createAiJob}
                    isCreatingAiJob = {props.isCreatingAiJob}
                    isRunningAiJob={props.isRunningAiJob}
                    isAIModulePage={props.isAIModulePage}
                    startTimeRef={props.startTimeRef}
                    pauseTimeRef={props.pauseTimeRef}
                    endTimeRef={props.endTimeRef}
                    isPaused={props.isPaused}
                    isBackgroundTranscribing={isBackgroundTranscribing}
                />
                 
            </div>
        </div>
    )

}