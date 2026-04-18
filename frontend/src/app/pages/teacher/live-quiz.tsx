import { AudioManager } from "@/components/ai/WhisperManager";
import { useTranscriber } from "@/hooks/useTranscriber";

export function LiveQuiz() {
    const transcriber = useTranscriber();

    return (
        <div className='flex justify-center items-center min-h-screen'>
            <div className='container flex flex-col justify-center items-center'>
                <AudioManager transcriber={transcriber} />
                <p>
                    {transcriber.output?.text}
                </p>
            </div>
        </div>
    );
}