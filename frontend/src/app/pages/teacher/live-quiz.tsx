import { AudioManager } from "@/components/ai/WhisperManager";
import { useTranscriber } from "@/hooks/useTranscriber";

export function LiveQuiz() {
    const transcriber = useTranscriber();

    return (
        <div className="flex justify-center items-start py-10">
            <div className="w-full max-w-3xl flex flex-col items-center gap-6">
            {/* Audio Manager */}
            <AudioManager transcriber={transcriber} />

            {/* Transcription Display */}
            {transcriber.output?.text && (
                <div className="w-full bg-white dark:bg-card/50 border border-gray-200 dark:border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Transcription Result
                </h3>
                <p className="text-base leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                    {transcriber.output?.text}
                </p>
                </div>
            )}
            </div>
        </div>
    )

}