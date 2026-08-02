import React, { useRef, useEffect, useState } from 'react';
import { Badge, Course } from '../types';
import { BadgeSVG } from './BadgeCard';
import { Download, Copy, Check, Linkedin, RefreshCw, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface LinkedInShareCardProps {
  badge: Badge;
  streakCount: number;
  courses: Course[];
  userEmail: string;
  onClose: () => void;
}

export const LinkedInShareCard: React.FC<LinkedInShareCardProps> = ({
  badge,
  streakCount,
  courses,
  userEmail,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [studentName, setStudentName] = useState(userEmail.split('@')[0].toUpperCase().replace(/[._-]/g, ' ') || 'V. ADITYA');
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.name || 'Advanced Algorithms & Vedic Lore');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Suggested share post text
  const shareText = `🎯 Unconditional Commitment Pays Off!

I am incredibly thrilled to share that I have reached a ${streakCount}-day continuous learning streak on ViBe! This unlocks the legendary "${badge.name}" Badge.

Unlike traditional platforms that reward cramming, ViBe recognizes consistency and disciplined daily effort—which is how genuine retention and skill are forged. Showing up for 15+ minutes every day is a test of character, and I'm proud to carry this token of King Vikram's resolve.

Special thanks to ViBe for building learning experiences that reward discipline!

#ViBeStreaks #Consistency #ContinuousLearning #BetaalsRiddles #ProfessionalDiscipline`;

  // Draw the share card onto the canvas
  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI canvas size for clear text
    canvas.width = 1200;
    canvas.height = 630;

    // 1. Draw Background Gradient (Cosmic Slate Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#020617'); // slate-950
    bgGrad.addColorStop(0.5, '#0f172a'); // slate-900
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Draw Subtle Indian Mandala/Grid Details in Background
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.04)'; // faint amber
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 630);
      ctx.stroke();
    }
    for (let j = 0; j < 630; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(1200, j);
      ctx.stroke();
    }

    // Circular glowing nodes in background
    ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
    ctx.beginPath();
    ctx.arc(600, 315, 250, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Outer Elegant Border (Golden Theme)
    const borderGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    borderGrad.addColorStop(0, '#d4af37'); // bright gold
    borderGrad.addColorStop(0.5, '#aa7c11'); // rich gold
    borderGrad.addColorStop(1, '#f3c623'); // metallic gold
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 1200 - 16, 630 - 16);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 1200 - 40, 630 - 40);

    // 4. Draw Header: "CREDENTIAL OF PERSISTENCE" & ViBe Logo
    ctx.fillStyle = '#f59e0b'; // amber-500
    ctx.font = 'bold 22px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('V I B E   L E A R N I N G   P L A T F O R M', 600, 75);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic bold 15px sans-serif';
    ctx.fillText('— OFFICIAL VERIFIABLE BADGE CARD —', 600, 105);

    // 5. Draw Main Content Area
    // Draw Golden Laurel Wreath / Circle around the badge area (Left side)
    const centerX = 320;
    const centerY = 330;

    // Draw glowing sun halo behind badge
    const radGrad = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, 150);
    radGrad.addColorStop(0, 'rgba(245,158,11,0.15)');
    radGrad.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.fill();

    // Draw intricate circles
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 130, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Left Side: Label for Streak
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${streakCount}`, centerX, centerY - 15);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px "JetBrains Mono", Courier, monospace';
    ctx.fillText('DAYS ACTIVE', centerX, centerY + 22);
    ctx.fillText('UNBROKEN', centerX, centerY + 42);

    // 6. Right Side Text: Student Name, Course, Badge
    const textStartX = 540;
    
    // Recipient Label
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('STRENGTH OF HABIT RECOGNIZED FOR', textStartX, 220);

    // Recipient Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(studentName, textStartX, 275);

    // Divider Line
    const dividerGrad = ctx.createLinearGradient(textStartX, 0, textStartX + 450, 0);
    dividerGrad.addColorStop(0, '#f59e0b');
    dividerGrad.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = dividerGrad;
    ctx.fillRect(textStartX, 295, 450, 3);

    // Course Name Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('COGNITIVE COURSE PATH:', textStartX, 330);

    // Course Name
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(selectedCourse, textStartX, 360);

    // Badge Title Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('AWARDED CRITICAL HABIT BADGE:', textStartX, 415);

    // Badge Name
    ctx.fillStyle = '#fbbf24'; // amber-400
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(badge.name.toUpperCase(), textStartX, 460);

    // Significance / Lore Subtext
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 16px sans-serif';
    // Warp text if too long
    const phrase = `"${badge.significance} Underpinned by continuous daily consistency."`;
    ctx.fillText(phrase, textStartX, 500);

    // 7. Verification Seal (Bottom right)
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(930, 480, 200, 75);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.05)';
    ctx.fillRect(930, 480, 200, 75);

    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED AUTHENTIC', 1030, 505);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('HASH: VIBE-STRK-' + badge.id.toUpperCase() + '-' + streakCount, 1030, 525);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px monospace';
    ctx.fillText('VERIFIED BY VIBE ENGINE', 1030, 542);
  };

  useEffect(() => {
    drawCard();
  }, [badge, streakCount, studentName, selectedCourse]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);

    setTimeout(() => {
      try {
        const link = document.createElement('a');
        link.download = `ViBe_Streak_Badge_${badge.id}_${streakCount}days.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Download error', err);
      } finally {
        setDownloading(false);
      }
    }, 600);
  };

  return (
    <div id="linkedin-customizer-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="border-b border-slate-800 p-4 px-6 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/15 text-blue-400 rounded-lg">
              <Linkedin className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                LinkedIn Share Card Generator
              </h2>
              <p className="text-xs text-slate-400">
                Share your proof of consistency with professional recruiters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold p-1 hover:bg-slate-800 rounded-lg transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Customizer Column */}
          <div className="p-6 lg:col-span-4 flex flex-col gap-5 justify-between">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300 font-mono tracking-wider uppercase border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" /> Customize Card
              </h3>

              {/* Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-slate-400">Student Recipient Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value.toUpperCase())}
                  className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-100 text-sm focus:outline-none focus:border-amber-500/50 transition-all font-sans font-medium"
                  placeholder="E.G. ADITYA SHARMA"
                />
              </div>

              {/* Course Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-slate-400">Select Learning Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                  <option value="Self-Directed Exploration & Vedic Lore">
                    Self-Directed Spaced Repetition Path
                  </option>
                </select>
              </div>

              {/* Badge Stats Display */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
                  <BadgeSVG id={badge.id} className="w-16 h-16" unlocked={true} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">{badge.name}</h4>
                  <p className="text-xs text-amber-500 font-mono font-semibold">{streakCount} Days Active</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {badge.significance}
                  </p>
                </div>
              </div>

              {/* LinkedIn Post Copy Area */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono text-slate-400">LinkedIn Post Text</label>
                  <button
                    onClick={handleCopyText}
                    className="text-[11px] font-mono text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Text
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={shareText}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 h-28 focus:outline-none resize-none font-sans"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={handleDownload}
                disabled={downloading}
                id="btn-download-badge-card"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer text-sm"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Rendering...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Download Badge Card (PNG)
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 font-semibold py-2 px-4 rounded-xl text-xs transition-all"
              >
                Cancel & Return
              </button>
            </div>
          </div>

          {/* Right Preview Column */}
          <div className="p-6 lg:col-span-8 bg-slate-950/40 flex flex-col gap-4 overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-300 font-mono tracking-wider uppercase border-b border-slate-800 pb-2 flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-blue-400 fill-current" /> Live LinkedIn Post Mockup
            </h3>

            {/* Simulated LinkedIn post frame */}
            <div className="border border-slate-800 rounded-xl bg-slate-900 shadow-xl max-w-2xl mx-auto w-full text-slate-300 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-slate-100 font-bold font-sans text-sm shadow-md">
                  {studentName[0] || 'V'}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1">
                    {studentName} <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-normal">1st</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Aspiring Software Engineer & Continuous Learner</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">Just now • 🌐</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4 line-clamp-4">
                {shareText}
              </p>

              {/* Live Canvas Rendering of the Card */}
              <div className="border border-slate-800 rounded-lg overflow-hidden shadow-inner bg-slate-950 relative group">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto block"
                  style={{ maxHeight: '310px', objectFit: 'contain' }}
                />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                  <span className="text-xs bg-slate-900 border border-slate-800 text-amber-500 font-mono py-1.5 px-3 rounded-lg shadow-md flex items-center gap-1">
                    <Download className="w-3 h-3" /> High-Res 1200x630px Canvas
                  </span>
                </div>
              </div>

              {/* Post Interactive Bar */}
              <div className="border-t border-slate-800/80 mt-3 pt-3 flex justify-between text-xs text-slate-400 font-semibold px-2">
                <span className="hover:text-blue-400 transition-colors cursor-pointer">👍 Like</span>
                <span className="hover:text-blue-400 transition-colors cursor-pointer">💬 Comment</span>
                <span className="hover:text-blue-400 transition-colors cursor-pointer">🔁 Repost</span>
                <span className="hover:text-blue-400 transition-colors cursor-pointer">📤 Send</span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                ⭐ This card is rendered instantly using our local client-side high-DPI canvas engine, guaranteeing crisp text and professional layout suitable for recruiting networks.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
