import { useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

interface CertificateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  versionId: string;
}

interface CertificateSnapshot {
  certificateId: string;
  userName: string;
  avatarUrl?: string;
  courseName: string;
  issuedAt: string;
}

export function CertificateModal({
  isOpen,
  onOpenChange,
  courseId,
  versionId,
}: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [certificate, setCertificate] = useState<CertificateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setError(null);
    setCertificate(null);

    const loadCertificate = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BASE_URL}/users/enrollments/courses/${courseId}/versions/${versionId}/certificate`,
          {
            headers: {
              Authorization: `Bearer ${token || localStorage.getItem("firebase-auth-token") || ""}`,
            },
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load certificate");
        }

        if (!cancelled) {
          setCertificate(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load certificate");
          setIsRendering(false);
        }
      }
    };

    void loadCertificate();

    return () => {
      cancelled = true;
    };
  }, [isOpen, courseId, versionId, token]);

  useEffect(() => {
    if (!isOpen || !certificate) return;
    setIsRendering(true);

    let cancelled = false;
    let rafId = 0;
    const userName = certificate.userName;
    const avatarUrl = certificate.avatarUrl;
    const courseName = certificate.courseName;
    const completionDate = new Date(certificate.issuedAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const certificateId = certificate.certificateId;

    const paint = (retry = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        if (cancelled) return;
        // Dialog portals content — ref may not exist for several frames.
        if (retry < 30) {
          rafId = requestAnimationFrame(() => paint(retry + 1));
          return;
        }
        setIsRendering(false);
        return;
      }

    const W = 1200;
    const H = 850;
    canvas.width = W;
    canvas.height = H;

    const drawCertificate = (avatarImg?: HTMLImageElement) => {
      // ── Background ──
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#fffdf7");
      bgGrad.addColorStop(0.5, "#fff9eb");
      bgGrad.addColorStop(1, "#fffdf7");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Outer border ──
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, W - 40, H - 40);

      // ── Inner border ──
      ctx.strokeStyle = "#daa520";
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, W - 70, H - 70);

      // ── Decorative corner flourishes ──
      drawCornerFlourish(ctx, 20, 20, 1, 1);
      drawCornerFlourish(ctx, W - 20, 20, -1, 1);
      drawCornerFlourish(ctx, 20, H - 20, 1, -1);
      drawCornerFlourish(ctx, W - 20, H - 20, -1, -1);

      // ── Decorative top line ──
      ctx.beginPath();
      ctx.moveTo(200, 100);
      ctx.lineTo(W - 200, 100);
      ctx.strokeStyle = "#daa520";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Title ──
      ctx.fillStyle = "#b8860b";
      ctx.font = "bold 18px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("✦  ✦  ✦", W / 2, 85);

      ctx.fillStyle = "#2c1810";
      ctx.font = "bold 44px Georgia, serif";
      ctx.fillText("Certificate of Completion", W / 2, 155);

      // ── Subtitle line ──
      ctx.beginPath();
      ctx.moveTo(350, 175);
      ctx.lineTo(W - 350, 175);
      ctx.strokeStyle = "#daa520";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── "This is to certify that" ──
      ctx.fillStyle = "#5a4a3a";
      ctx.font = "italic 20px Georgia, serif";
      ctx.fillText("This is to certify that", W / 2, 215);

      // ── Profile picture ──
      const avatarY = 240;
      const avatarR = 55;
      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, avatarY + avatarR, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          avatarImg,
          W / 2 - avatarR,
          avatarY,
          avatarR * 2,
          avatarR * 2
        );
        ctx.restore();

        // Avatar border ring
        ctx.beginPath();
        ctx.arc(W / 2, avatarY + avatarR, avatarR + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#daa520";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // ── Student name ──
      const nameY = avatarImg ? avatarY + avatarR * 2 + 45 : 310;
      ctx.fillStyle = "#1a0f08";
      ctx.font = "bold 40px Georgia, serif";
      ctx.fillText(userName || "Student", W / 2, nameY);

      // Name underline
      const nameWidth = ctx.measureText(userName || "Student").width;
      ctx.beginPath();
      ctx.moveTo(W / 2 - nameWidth / 2 - 20, nameY + 12);
      ctx.lineTo(W / 2 + nameWidth / 2 + 20, nameY + 12);
      ctx.strokeStyle = "#daa520";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── "has successfully completed" ──
      ctx.fillStyle = "#5a4a3a";
      ctx.font = "italic 20px Georgia, serif";
      ctx.fillText("has successfully completed the course", W / 2, nameY + 55);

      // ── Course name ──
      ctx.fillStyle = "#2c1810";
      ctx.font = "bold 32px Georgia, serif";
      // Wrap long course names
      const maxCourseWidth = W - 200;
      const courseText = courseName || "Course";
      const courseMeasured = ctx.measureText(courseText).width;
      if (courseMeasured > maxCourseWidth) {
        ctx.font = "bold 24px Georgia, serif";
      }
      ctx.fillText(courseText, W / 2, nameY + 105);

      // ── "with 100% completion" ──
      ctx.fillStyle = "#5a4a3a";
      ctx.font = "italic 18px Georgia, serif";
      ctx.fillText("with 100% completion", W / 2, nameY + 145);

      // ── Decorative bottom line ──
      ctx.beginPath();
      ctx.moveTo(200, H - 170);
      ctx.lineTo(W - 200, H - 170);
      ctx.strokeStyle = "#daa520";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Completion date ──
      ctx.fillStyle = "#5a4a3a";
      ctx.font = "16px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText(`Date: ${completionDate}`, 120, H - 120);

      // ── Certificate ID ──
      ctx.textAlign = "right";
      ctx.fillStyle = "#999";
      ctx.font = "12px Georgia, serif";
      ctx.fillText(`ID: ${certificateId}`, W - 120, H - 120);

      // ── Seal / emblem area ──
      ctx.textAlign = "center";
      ctx.beginPath();
      ctx.arc(W / 2, H - 115, 35, 0, Math.PI * 2);
      const sealGrad = ctx.createRadialGradient(
        W / 2, H - 115, 5,
        W / 2, H - 115, 35
      );
      sealGrad.addColorStop(0, "#f0d060");
      sealGrad.addColorStop(1, "#b8860b");
      ctx.fillStyle = sealGrad;
      ctx.fill();
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Seal star
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Georgia, serif";
      ctx.fillText("★", W / 2, H - 105);

      // ── Bottom decorative stars ──
      ctx.fillStyle = "#b8860b";
      ctx.font = "bold 18px Georgia, serif";
      ctx.fillText("✦  ✦  ✦", W / 2, H - 55);

      if (!cancelled) setIsRendering(false);
    };

    // Load avatar image, then draw
    if (avatarUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!cancelled) drawCertificate(img);
      };
      img.onerror = () => {
        if (!cancelled) drawCertificate(); // Draw without avatar on error
      };
      img.src = avatarUrl;
    } else {
      drawCertificate();
    }
    };

    rafId = requestAnimationFrame(() => paint(0));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [isOpen, certificate]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !certificate) return;

    const link = document.createElement("a");
    link.download = `certificate-${certificate.userName.replace(/\s+/g, "_").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            🎓 Your Certificate of Completion
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col items-center gap-4 py-2">
          {error ? (
            <div className="w-full max-w-[900px] rounded-lg border p-6 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full max-w-[900px] h-auto border rounded-lg shadow-lg"
              style={{ aspectRatio: "1200 / 850" }}
            />
          )}

          <Button
            onClick={handleDownload}
            disabled={isRendering || !!error || !certificate}
            className="gap-2"
            size="lg"
          >
            {isRendering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Certificate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Draw a decorative corner flourish */
function drawCornerFlourish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number
) {
  ctx.save();
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // L-shape
  ctx.beginPath();
  ctx.moveTo(x, y + dy * 50);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dx * 50, y);
  ctx.stroke();

  // Inner curved accent
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#daa520";
  ctx.beginPath();
  ctx.moveTo(x + dx * 10, y + dy * 40);
  ctx.quadraticCurveTo(x + dx * 10, y + dy * 10, x + dx * 40, y + dy * 10);
  ctx.stroke();

  ctx.restore();
}
