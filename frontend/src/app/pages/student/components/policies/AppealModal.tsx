import {useState, useRef} from 'react';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {ImagePlus, X} from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: string;
  onSubmit: (data: {reason: string; evidenceUrl?: string; images: File[]}) => Promise<void>;
};

export function AppealModal({isOpen, onClose, onSubmit, enrollmentId}: Props) {
  const [reason, setReason] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const combined = [...images, ...selected].slice(0, 5); // hard-cap at 5
    setImages(combined);
    setPreviews(combined.map(f => URL.createObjectURL(f)));
    // reset input so same file can be re-added after removal
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    try {
      setLoading(true);
      await onSubmit({reason, images});
      onClose();
      setReason('');
      setImages([]);
      setPreviews([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => {if (!open) onClose();}}>
      <DialogContent onClick={e => e.stopPropagation()} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Appeal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Textarea
            placeholder="Explain why you should be reinstated..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
          />

          {/* ── Image upload ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Evidence Images
                <span className="text-muted-foreground font-normal ml-1">
                  (up to 5)
                </span>
              </p>
              {images.length < 5 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Add image
                </Button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-md overflow-hidden border border-border aspect-square">
                    <img
                      src={src}
                      alt={`evidence-${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className="w-full"
          >
            {loading ? 'Submitting...' : 'Submit Appeal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}