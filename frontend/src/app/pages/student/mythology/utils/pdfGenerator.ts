import { jsPDF } from 'jspdf';
import { UserStreakState } from '../types';
import { LIST_BADGES } from '../components/BadgeCard';

export function generateMonthlyPDF(state: UserStreakState) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // A4 dimensions: 210mm x 297mm
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;

  // Define Colors
  const cSlateDark = [15, 23, 42]; // rgb(15, 23, 42) - Midnight slate
  const cGold = [217, 119, 6];     // rgb(217, 119, 6) - Gold/Amber
  const cGoldLight = [251, 191, 36]; // rgb(251, 191, 36) - Light amber
  const cIndigo = [79, 70, 229];    // rgb(79, 70, 229) - Primary indigo
  const cTextDark = [30, 41, 59];   // rgb(30, 41, 59) - Slate 800
  const cTextMuted = [100, 116, 139]; // rgb(100, 116, 139) - Slate 500
  const cBgLight = [248, 250, 252]; // rgb(248, 250, 252) - Slate 50
  const cBorder = [226, 232, 240];  // rgb(226, 232, 240) - Slate 200

  // Helper: Draw borders around page
  function drawPageBorders() {
    doc.setDrawColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
    doc.setLineWidth(1);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Inner gold border
    doc.setDrawColor(cGold[0], cGold[1], cGold[2]);
    doc.setLineWidth(0.4);
    doc.rect(margin + 1.5, margin + 1.5, pageWidth - 2 * margin - 3, pageHeight - 2 * margin - 3);
  }

  // Draw first page border
  drawPageBorders();

  // ==========================================
  // HEADER BANNER (ViBe Mythology Theme)
  // ==========================================
  const headerY = margin + 3;
  const headerHeight = 32;

  // Dark slate banner background
  doc.setFillColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
  doc.rect(margin + 3, headerY, pageWidth - 2 * margin - 6, headerHeight, 'F');

  // Gold accent bar at bottom of banner
  doc.setFillColor(cGold[0], cGold[1], cGold[2]);
  doc.rect(margin + 3, headerY + headerHeight - 2, pageWidth - 2 * margin - 6, 2, 'F');

  // Header Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('ViBe Mythology Portal', margin + 8, headerY + 11);

  // Header Subtitle / Slogan
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(cGoldLight[0], cGoldLight[1], cGoldLight[2]);
  doc.text('Quest for Knowledge & Unbroken Habit Resolve', margin + 8, headerY + 17);

  // Right Side Header Metadata
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('MONTHLY LEDGER', pageWidth - margin - 8, headerY + 11, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin - 8, headerY + 16, { align: 'right' });
  doc.text(`Epoch Date: ${state.systemDate}`, pageWidth - margin - 8, headerY + 21, { align: 'right' });

  // ==========================================
  // USER INFO & KEY STATS (4-Column Layout)
  // ==========================================
  const statsY = headerY + headerHeight + 6;
  const statCardWidth = (pageWidth - 2 * margin - 12) / 4; // Width for 4 cards
  const statCardHeight = 22;

  const stats = [
    { label: 'DISCIPLINE SEEKER', value: 'vibeseeker' },
    { label: 'ACTIVE STREAK', value: `${state.currentStreak} Days`, desc: `Max Record: ${state.longestStreak} d` },
    { label: 'KARMIC BALANCE', value: `${state.karmaPoints} KP`, desc: 'Total study weight' },
    { label: 'GILDED MILESTONES', value: `${state.unlockedBadges.length} / 6`, desc: 'Unlocked Badges' }
  ];

  stats.forEach((stat, i) => {
    const x = margin + 3 + i * (statCardWidth + 2);
    
    // Draw background card
    doc.setFillColor(cBgLight[0], cBgLight[1], cBgLight[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.setLineWidth(0.3);
    doc.rect(x, statsY, statCardWidth, statCardHeight, 'FD');

    // Left border indicator (indigo)
    doc.setFillColor(cIndigo[0], cIndigo[1], cIndigo[2]);
    doc.rect(x, statsY, 1.5, statCardHeight, 'F');

    // Stat Label
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(stat.label, x + 4, statsY + 5);

    // Stat Value
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
    doc.text(stat.value, x + 4, statsY + 11.5);

    // Stat secondary text (if exists)
    if (stat.desc) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
      doc.text(stat.desc, x + 4, statsY + 17);
    }
  });

  // ==========================================
  // SECTION: UNLOCKED GILDED BADGES
  // ==========================================
  let currentY = statsY + statCardHeight + 8;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
  doc.text('Gilded Milestones & Lore', margin + 3, currentY);

  // Border bottom for section
  doc.setFillColor(cIndigo[0], cIndigo[1], cIndigo[2]);
  doc.rect(margin + 3, currentY + 1.5, pageWidth - 2 * margin - 6, 0.5, 'F');

  currentY += 6;

  // Filter out badges
  const unlockedBadgesInfo = LIST_BADGES.filter(b => state.unlockedBadges.includes(b.id));

  if (unlockedBadgesInfo.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text('No gilded milestones unlocked yet in this epoch. Complete daily quests to begin unlocking ancient badges!', margin + 5, currentY + 4);
    currentY += 10;
  } else {
    unlockedBadgesInfo.forEach((badge) => {
      // Draw small card for badge
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
      doc.rect(margin + 3, currentY, pageWidth - 2 * margin - 6, 16, 'FD');

      // Gold badge background block
      doc.setFillColor(cGold[0], cGold[1], cGold[2]);
      doc.rect(margin + 3.3, currentY + 0.3, 15, 15.4, 'F');

      // Medal asterisk symbol representing badge
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('★', margin + 10.5, currentY + 11.5, { align: 'center' });

      // Badge details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
      doc.text(badge.name, margin + 21, currentY + 5);

      // Requirement text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(cIndigo[0], cIndigo[1], cIndigo[2]);
      doc.text(`${badge.daysRequired} DAY STREAK`, margin + 21, currentY + 9.5);

      // Significance or Lore (clipped to single line nicely)
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
      const loreText = badge.lore.length > 105 ? badge.lore.substring(0, 102) + '...' : badge.lore;
      doc.text(`"${loreText}"`, margin + 21, currentY + 13.5);

      currentY += 18;
    });
  }

  // ==========================================
  // SECTION: CHRONOLOGICAL ACTIVITY LEDGER
  // ==========================================
  currentY += 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
  doc.text('Chronological Activity Ledger', margin + 3, currentY);

  // Border bottom for section
  doc.setFillColor(cIndigo[0], cIndigo[1], cIndigo[2]);
  doc.rect(margin + 3, currentY + 1.5, pageWidth - 2 * margin - 6, 0.5, 'F');

  currentY += 6;

  // Table structure
  const colX = {
    date: margin + 3,
    time: margin + 28,
    type: margin + 46,
    activity: margin + 74,
    status: pageWidth - margin - 3 // aligned right
  };

  // Draw Table Headers
  doc.setFillColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
  doc.rect(margin + 3, currentY, pageWidth - 2 * margin - 6, 7, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DATE', colX.date + 3, currentY + 4.8);
  doc.text('TIME', colX.time, currentY + 4.8);
  doc.text('CATEGORY', colX.type, currentY + 4.8);
  doc.text('ACTIVITY TASK / DEED', colX.activity, currentY + 4.8);
  doc.text('STATUS', colX.status - 3, currentY + 4.8, { align: 'right' });

  currentY += 7;

  // Table rows
  const sortedLogs = [...state.logs].sort((a, b) => {
    return b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp);
  });

  if (sortedLogs.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.rect(margin + 3, currentY, pageWidth - 2 * margin - 6, 12, 'FD');

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text('No learning activities logged in this cycle.', margin + 8, currentY + 7.5);
  } else {
    sortedLogs.forEach((log, index) => {
      // Check if page overflow will occur (A4 page height limit check)
      if (currentY > pageHeight - margin - 25) {
        // Draw footer for page 1
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
        doc.text('Continued on Next Page...', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

        // Add new page
        doc.addPage();
        drawPageBorders();
        
        // Reset Y coordinate
        currentY = margin + 10;
        
        // Re-draw headers on new page
        doc.setFillColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
        doc.rect(margin + 3, currentY, pageWidth - 2 * margin - 6, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('DATE', colX.date + 3, currentY + 4.8);
        doc.text('TIME', colX.time, currentY + 4.8);
        doc.text('CATEGORY', colX.type, currentY + 4.8);
        doc.text('ACTIVITY TASK / DEED', colX.activity, currentY + 4.8);
        doc.text('STATUS', colX.status - 3, currentY + 4.8, { align: 'right' });

        currentY += 7;
      }

      // Alternating row background colors
      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : cBgLight[0], isEven ? 255 : cBgLight[1], isEven ? 255 : cBgLight[2]);
      doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
      doc.rect(margin + 3, currentY, pageWidth - 2 * margin - 6, 8, 'FD');

      // Date & Time
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
      doc.text(log.date, colX.date + 3, currentY + 5);
      doc.text(log.timestamp || '--:--', colX.time, currentY + 5);

      // Category Type badge style
      let catLabel = log.activityType.toUpperCase();
      if (catLabel === 'SPACED-REP') catLabel = 'REPETITION';
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(cIndigo[0], cIndigo[1], cIndigo[2]);
      doc.text(catLabel, colX.type, currentY + 5);

      // Activity description
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
      const actName = log.activityName.length > 62 ? log.activityName.substring(0, 59) + '...' : log.activityName;
      doc.text(actName, colX.activity, currentY + 5);

      // Verified status
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(34, 197, 94); // emerald
      doc.text('VERIFIED', colX.status - 3, currentY + 5, { align: 'right' });

      currentY += 8;
    });
  }

  // ==========================================
  // ANCIENT DECREE & FOOTER
  // ==========================================
  const footerHeightNeeded = 22;
  if (currentY > pageHeight - margin - footerHeightNeeded) {
    doc.addPage();
    drawPageBorders();
    currentY = margin + 15;
  } else {
    currentY = pageHeight - margin - footerHeightNeeded;
  }

  // Draw separator line
  doc.setDrawColor(cGold[0], cGold[1], cGold[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 3, currentY, pageWidth - margin - 3, currentY);

  // Footer text - The Oath Decree
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  doc.text(
    '“Decreed under the oath of King Vikram & the legendary Vetaal. As your learning progress flows, your karmic mind deepens.”',
    pageWidth / 2,
    currentY + 5,
    { align: 'center' }
  );

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(cSlateDark[0], cSlateDark[1], cSlateDark[2]);
  doc.text('ViBe Official Certification Layer', pageWidth / 2, currentY + 11, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  doc.text(
    `Cryptographic Verification Block: SHA256-VIBE-${state.karmaPoints}-${state.currentStreak}-${state.unlockedBadges.length}`,
    pageWidth / 2,
    currentY + 15,
    { align: 'center' }
  );

  // Save PDF
  doc.save(`ViBe_Mythology_Summary_${state.systemDate}.pdf`);
}
