import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useState, useEffect, useRef } from 'react';
import { Copy, Download, Search, Volume2, VolumeX, RotateCcw, Maximize2, Minimize2, FileText, Mic, MicOff, Eye, EyeOff, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TranscriptionResultProps {
  transcription: string;
  isProcessing?: boolean;
  isRunningAiJob?: boolean;
  onTranscriptionUpdate: (text: string) => void;
  className?: string;
  audioUrl?: string;
  language?: string;
  tooltipContent?: string;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  startTime?: number | null;
  endTime?: number | null;
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({
  transcription,
  isProcessing = false,
  isRunningAiJob = false,
  onTranscriptionUpdate,
  className = '',
  audioUrl,
  tooltipContent,
  isEditing,
  setIsEditing,
  startTime,
  endTime,
}) => {
  // const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(transcription);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedText, setHighlightedText] = useState(transcription);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when transcription prop changes
  useEffect(() => {
    setEditedText(transcription);
    setHighlightedText(transcription);
  }, [transcription]);



  // Handle search and highlighting
  useEffect(() => {
    if (searchTerm.trim()) {
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const highlighted = transcription.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-600 px-1 rounded">$1</mark>');
      setHighlightedText(highlighted);
    } else {
      setHighlightedText(transcription);
    }
  }, [searchTerm, transcription]);

  const handleSave = () => {
    if (editedText.trim().length === 0) {
      setError('Transcription cannot be empty');
      return;
    }

    onTranscriptionUpdate(editedText);
    setIsEditing(false);
    setError('');
  };

  const handleCancel = () => {
    setEditedText(transcription);
    setIsEditing(false);
    setError('');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const getWordCount = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const getReadingTime = (text: string) => {
    const words = getWordCount(text);
    return Math.ceil(words / 200); // Average reading speed: 200 words per minute
  };

  function formatTime(seconds: number | undefined): string {
    if (seconds === undefined) return "00:00";
    if (!Number.isFinite(seconds)) return "00:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return (
    <div className={`w-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-card ${className}`}>
      {/* Header */}
      <div className="flex lg:flex-nowrap flex-wrap justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700  bg-card rounded-t-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Transcription Result</h3>
            {/* <p className="text-sm text-gray-500 dark:text-gray-400">{timestamp}</p> */}
            {startTime !== null && endTime !== null && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {`Segment: ${formatTime(startTime)} - ${formatTime(endTime)}`}
              </p>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />
              </TooltipTrigger>
              {tooltipContent && (
                <TooltipContent>
                  <p>{tooltipContent}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {isProcessing && (
            <div className="flex items-center gap-2 ml-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                <Mic className="w-3 h-3 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Processing...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats Toggle */}
          <Button
            onClick={() => setShowStats(!showStats)}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            {showStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>

          {/* Expand Toggle */}
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          {/* Action Buttons */}
          {!isProcessing && transcription && (
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className={`p-2 transition-colors ${copySuccess ? 'text-green-600' : ''}`}
                disabled={copySuccess}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleDownload}
                variant="ghost"
                size="sm"
                className={`p-2 transition-colors ${downloadSuccess ? 'text-green-600' : ''}`}
                disabled={downloadSuccess}
              >
                <Download className="w-4 h-4" />
              </Button>
              {audioUrl && (
                <>
                  <Button
                    onClick={toggleAudio}
                    variant="ghost"
                    size="sm"
                    className="p-2"
                  >
                    {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
                </>
              )}
            </div>
          )}

          {/* Edit Controls */}
          {!isRunningAiJob && !isProcessing && transcription && (
            <div className="flex gap-2 ml-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-300"
                >
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {showStats && transcription && (
        <div className="px-6 py-4 bg-card border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Words</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{getWordCount(transcription)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Characters</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{transcription.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Reading Time</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{getReadingTime(transcription)}min</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!isEditing && transcription && (
        <div className="p-4 bg-card backdrop-blur-sm">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search in transcription..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6 pb-0 bg-card">
        <div className={`transition-all duration-300 ${isExpanded ? 'min-h-[400px]' : 'min-h-[230px]'}`}>
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => {
                  setError('');
                  setEditedText(e.target.value);
                  setHighlightedText(e.target.value);
                }}
                className={`w-full p-4 text-base leading-relaxed text-gray-800 dark:text-gray-100 bg-card border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all shadow-sm ${isExpanded ? 'h-[350px]' : 'h-[200px]'}`}
                placeholder="Edit your transcription here..."
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}
              {/* <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 bg-card p-2 rounded-lg">
                <span>Characters: {editedText.length}</span>
                <span>Words: {getWordCount(editedText)}</span>
                <span>Reading time: {getReadingTime(editedText)}min</span>
              </div> */}
            </div>
          ) : (
            <div className={`w-full p-4 text-base leading-relaxed bg-card text-gray-800 dark:text-gray-100 bg-gradient-to-br   border border-gray-200 dark:border-gray-600 rounded-xl overflow-y-auto shadow-inner ${isExpanded ? 'h-[350px]' : 'h-[200px]'}`}>
              {transcription ? (
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightedText }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-card">
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 mx-auto bg-card rounded-full flex items-center justify-center">
                        <MicOff className="w-8 h-8" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-card rounded-full flex items-center justify-center">
                        <FileText className="w-3 h-3" />
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-medium">No transcription available</p>
                      <p className="text-sm">Upload an audio file to get started</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {transcription && (
        <div className="px-6 py-2 bg-card rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            {/* <span>Language: {language}</span> */}
            {copySuccess && <span className="text-green-600">✓ Copied to clipboard</span>}
            {downloadSuccess && <span className="text-green-600">✓ Downloaded successfully</span>}
          </div>
        </div>
      )}
    </div>
  );
};