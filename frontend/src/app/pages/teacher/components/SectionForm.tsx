import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { PlusCircle, X, Play, Clock, Edit, Trash2 } from "lucide-react";
import Video from "@/components/video";
import AISectionModal from "./AISectionModal";
import { useNavigate } from '@tanstack/react-router';

interface ContentItem {
  id: string;
  type: string;
  videoUrl?: string;
  blog?: string;
  quiz?: string;
  points?: string;
  range?: [number, number];
}

interface Section {
  id: string;
  title: string;
  contentItems: ContentItem[];
}

interface Props {
  sectionIndex: number;
  sectionData?: Section;
  onSectionChange: (updatedSection: Section) => void;
  selected: {
    moduleId: string | null;
    sectionId: string | null;
    contentItemId: string | null;
  };
  contentItemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function extractYouTubeId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export default function SectionForm({
  sectionIndex,
  sectionData,
  onSectionChange,
  selected,
  contentItemRefs,
}: Props) {
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [currentEditingItem, setCurrentEditingItem] = useState<{
    index: number;
    item: ContentItem;
  } | null>(null);
  const [tempVideoData, setTempVideoData] = useState({
    videoUrl: "",
    points: "",
    range: [0, 300] as [number, number],
  });
  const [showAIModal, setShowAIModal] = useState(false);
  const navigate = useNavigate();

  if (!sectionData) return null;

  const updateSectionTitle = (title: string) => {
    onSectionChange({ ...sectionData, title });
  };

  const addItem = () => {
    const newItem: ContentItem = {
      id: `content-${Date.now()}-${Math.random()}`,
      type: "",
      videoUrl: "",
      blog: "",
      quiz: "",
      points: "",
      range: [0, 300],
    };
    onSectionChange({
      ...sectionData,
      contentItems: [...sectionData.contentItems, newItem],
    });
  };

  const updateItem = (index: number, field: keyof ContentItem, value: any) => {
    const updatedItems = [...sectionData.contentItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    onSectionChange({ ...sectionData, contentItems: updatedItems });
  };

  const deleteItem = (index: number) => {
    const updatedItems = sectionData.contentItems.filter((_, idx) => idx !== index);
    onSectionChange({ ...sectionData, contentItems: updatedItems });
  };

  const handleTypeChange = (index: number, type: string) => {
    if (type === "video") {
      const item = sectionData.contentItems[index];
      setCurrentEditingItem({ index, item });
      setTempVideoData({
        videoUrl: item.videoUrl || "",
        points: item.points || "",
        range: item.range || [0, 300],
      });
      setShowVideoPopup(true);
    } else {
      updateItem(index, "type", type);
    }
  };

  const handleVideoEdit = (index: number) => {
    const item = sectionData.contentItems[index];
    setCurrentEditingItem({ index, item });
    setTempVideoData({
      videoUrl: item.videoUrl || "",
      points: item.points || "",
      range: item.range || [0, 300],
    });
    setShowVideoPopup(true);
  };

  const handleVideoSave = () => {
    if (currentEditingItem) {
      const { index } = currentEditingItem;
      const updatedItems = [...sectionData.contentItems];
      updatedItems[index] = {
        ...updatedItems[index],
        type: "video",
        videoUrl: tempVideoData.videoUrl,
        points: tempVideoData.points,
        range: tempVideoData.range,
      };
      onSectionChange({ ...sectionData, contentItems: updatedItems });
    }
    setShowVideoPopup(false);
    setCurrentEditingItem(null);
  };

  const handleVideoCancel = () => {
    if (currentEditingItem) {
      updateItem(currentEditingItem.index, "type", "");
    }
    setShowVideoPopup(false);
    setCurrentEditingItem(null);
    setTempVideoData({
      videoUrl: "",
      points: "",
      range: [0, 300],
    });
  };

  const VideoCard = ({ item, onEdit }: { item: ContentItem; onEdit: () => void }) => {
    const videoId = extractYouTubeId(item.videoUrl || "");
    const start = Math.floor(item.range?.[0] ?? 0);
    const end = Math.floor(item.range?.[1] ?? 0);
    
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <span className="font-medium text-card-foreground">Video Content</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 px-3 text-primary hover:bg-accent"
            >
              <span className="text-xs mr-1">Edit</span>
              <Edit className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="truncate">
              <span className="font-medium text-foreground">URL:</span> {item.videoUrl || "No URL"}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground">Start:</span> {formatTime(start)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground">End:</span> {formatTime(end)}
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Points:</span> {item.points || "0"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const videoId = extractYouTubeId(tempVideoData.videoUrl);
  const start = Math.floor(tempVideoData.range[0]);
  const end = Math.floor(tempVideoData.range[1]);

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button variant="default" onClick={() => navigate({to: '/teacher/ai-section'})}>
          Generate Section using AI
        </Button>
      </div>
      <Card className="bg-muted/20">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium text-lg">Section {sectionIndex + 1}</h3>

          <Input
            placeholder="Section Title"
            value={sectionData?.title ?? ""}
            onChange={(e) => updateSectionTitle(e.target.value)}
            className="w-full"
          />

          {sectionData?.contentItems?.map((item, idx) => {
            const isSelected =
              selected.sectionId === sectionData.id &&
              selected.contentItemId === item.id;

            return (
              <div
                key={item.id}
                ref={
                  isSelected
                    ? (el) => {
                        if (el) contentItemRefs.current.set(item.id, el);
                      }
                    : undefined
                }
                className="border p-4 rounded-md space-y-3 bg-muted/10"
              >
                <div className="flex items-center gap-2">
                  <Select
                    value={item.type}
                    onValueChange={(val) => handleTypeChange(idx, val)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Content Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(idx)}
                    className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {item.type === "video" && <VideoCard item={item} onEdit={() => handleVideoEdit(idx)} />}

                {item.type === "blog" && (
                  <Input
                    placeholder="Blog Link / Content"
                    value={item.blog}
                    onChange={(e) => updateItem(idx, "blog", e.target.value)}
                    className="w-full"
                  />
                )}

                {item.type === "quiz" && (
                  <Input
                    placeholder="Quiz Content / Link"
                    value={item.quiz}
                    onChange={(e) => updateItem(idx, "quiz", e.target.value)}
                    className="w-full"
                  />
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            onClick={addItem}
            className="w-full"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Content Item
          </Button>

          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => { /* TODO: Bind AI generation logic here */ }}
          >
            Generate Using by AI
          </Button>
        </CardContent>
      </Card>
      {/* <AISectionModal open={showAIModal} onOpenChange={setShowAIModal} /> */}
      {/* Video Configuration Popup */}
      {showVideoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ minHeight: '100vh' }}>
          <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[95vh] overflow-y-auto border shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Configure Video Content</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVideoCancel}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  YouTube Video URL
                </label>
                <Input
                  placeholder="Enter YouTube Video URL"
                  value={tempVideoData.videoUrl}
                  onChange={(e) =>
                    setTempVideoData(prev => ({ ...prev, videoUrl: e.target.value }))
                  }
                  className="w-full"
                />
              </div>

              {videoId && (
                <>
                  <div className="w-full h-[400px] border rounded-md p-0 bg-muted/20 overflow-hidden">
                    <div className="w-full h-full">
                      <Video
                        URL={tempVideoData.videoUrl}
                        startTime={formatTime(start)}
                        endTime={formatTime(end)}
                        points={tempVideoData.points}
                        doGesture={false}
                        rewindVid={false}
                        pauseVid={false}
                        onDurationChange={(dur) => {
                          setVideoDurations((prev) => ({ 
                            ...prev, 
                            [currentEditingItem?.item.id || 'temp']: dur 
                          }));
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Select Clip Range (Start to End)
                    </label>
                    <Slider
                      value={tempVideoData.range}
                      onValueChange={(val) =>
                        setTempVideoData(prev => ({ 
                          ...prev, 
                          range: val as [number, number] 
                        }))
                      }
                      max={videoDurations[currentEditingItem?.item.id || 'temp'] || 600}
                      step={1}
                    />
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>Start: {formatTime(start)}</span>
                      <span>End: {formatTime(end)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Points
                    </label>
                    <Input
                      placeholder="Enter points value"
                      type="number"
                      value={tempVideoData.points}
                      onChange={(e) =>
                        setTempVideoData(prev => ({ ...prev, points: e.target.value }))
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={handleVideoCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVideoSave}
                disabled={!tempVideoData.videoUrl}
              >
                Save Video
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}