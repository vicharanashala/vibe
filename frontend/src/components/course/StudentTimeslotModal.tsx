import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Users, Loader2, Check, Gift } from "lucide-react";
import {
  useGetTimeSlots,
  useMyBookings,
  useSlotAvailability,
  useMyExtraBookings,
  useBookSlot,
  useCancelBooking,
  bookableStudyDates,
  istToday,
  slotBookingClosed,
  type MyBooking,
} from "@/hooks/hooks";
import { cn } from "@/utils/utils";

// Friendly label for a YYYY-MM-DD study day relative to IST today.
const dayLabel = (date: string): string => {
  const today = istToday();
  if (date === today) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const todayMs = (() => {
    const [ty, tm, td] = today.split("-").map(Number);
    return Date.UTC(ty, tm - 1, td);
  })();
  const diff = Math.round((ms - todayMs) / (24 * 60 * 60 * 1000));
  if (diff === 1) return "Tomorrow";
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

interface StudentTimeslotModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
  cohortId?: string;
  // Accepted for call-site compatibility; no longer used (self-service booking).
  currentUserId?: string;
  hasAssignedTimeslot?: boolean;
}

// Helper component for time display
const TimeDisplay = ({ time }: { time: string }) => {
  const [hour, minute] = time.split(':');
  const h = parseInt(hour);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minute} ${suffix}`;
};

export default function StudentTimeslotModal({
  isOpen,
  onClose,
  courseId,
  courseVersionId,
  cohortId,
}: StudentTimeslotModalProps) {
  const { data: timeSlotsData, isLoading } = useGetTimeSlots(courseId, courseVersionId, isOpen);

  // Study days a student may book right now (today / tomorrow / day-after from
  // 9 AM IST). Per slot, a slot stays bookable until it starts. The first open
  // day is selected by default.
  const studyDates = bookableStudyDates();
  const [selectedDate, setSelectedDate] = useState<string>(studyDates[0]);
  const activeDate = studyDates.includes(selectedDate) ? selectedDate : studyDates[0];

  // All of the student's active bookings (any study day) — drives both the
  // per-booking-day allowance meter and the per-date "Booked" state.
  const {
    data: myBookings,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useMyBookings(courseId, courseVersionId, undefined, isOpen);
  const { data: availability, refetch: refetchAvailability } = useSlotAvailability(
    courseId,
    courseVersionId,
    activeDate,
    isOpen,
  );
  const { data: extraBookings, refetch: refetchExtraBookings } = useMyExtraBookings(
    courseId,
    courseVersionId,
    isOpen,
  );
  const { book, loading: booking } = useBookSlot();
  const { cancel, loading: cancelling } = useCancelBooking();

  const availabilityFor = (slot: { from: string; to: string }) =>
    availability?.slots.find(s => s.from === slot.from && s.to === slot.to);

  const refresh = () => {
    refetchBookings();
    refetchAvailability();
    refetchExtraBookings();
  };

  const tsSettings = timeSlotsData as
    | { dailyBaseAllowance?: number; bonusOnFulfillment?: boolean }
    | null
    | undefined;
  const baseAllowance = tsSettings?.dailyBaseAllowance ?? 1;
  const bonusEnabled = !!tsSettings?.bonusOnFulfillment;
  const bookings: MyBooking[] = myBookings ?? [];
  // Allowance is per calendar day the booking is MADE — count bookings created today.
  const today = istToday();
  const bookedCount = bookings.filter(b => (b.bookedOnDate ?? b.date) === today).length;
  // Bonus: each window FULFILLED today (when bonuses are enabled) grants one
  // extra booking today — mirrors the backend's effective-allowance math.
  const istDateOfIso = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const bonusEarnedToday = bonusEnabled
    ? bookings.filter(
        b => b.status === 'FULFILLED' && b.fulfilledAt && istDateOfIso(b.fulfilledAt) === today,
      ).length
    : 0;
  const allowance = baseAllowance + bonusEarnedToday;

  const bookingFor = (slot: { from: string; to: string }): MyBooking | undefined =>
    bookings.find(b => b.date === activeDate && b.from === slot.from && b.to === slot.to);

  const handleBook = async (slot: { from: string; to: string }) => {
    const res = await book(courseId, courseVersionId, { from: slot.from, to: slot.to }, cohortId, activeDate);
    if (res.success) {
      toast.success(`Slot booked for ${dayLabel(activeDate)}.`);
      refresh();
    } else {
      toast.error(res.message || 'Could not book this slot.');
    }
  };

  const handleCancel = async (bookingId: string) => {
    const res = await cancel(bookingId);
    if (res.success) {
      toast.success('Booking cancelled.');
      refresh();
    } else {
      toast.error(res.message || 'Could not cancel this booking.');
    }
  };

  if (isLoading || bookingsLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Time Slots</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading time slots...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!timeSlotsData?.isActive) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Time Slots</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No time slots are configured for this course. You can watch the course anytime.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const busy = booking || cancelling;
  const slots = timeSlotsData.slots ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold">Book your study time</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pick a day and when you'll study. You can open the course <span className="font-medium text-foreground">only during a window you've booked</span>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {studyDates.map(d => (
              <Button
                key={d}
                size="sm"
                variant={d === activeDate ? "default" : "outline"}
                onClick={() => setSelectedDate(d)}
              >
                {dayLabel(d)}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
              {bookedCount} of {allowance} booking{allowance !== 1 ? 's' : ''} used today
            </span>
            {bonusEarnedToday > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium">
                <Gift className="h-3.5 w-3.5" />
                +{bonusEarnedToday} bonus earned
              </span>
            ) : null}
            {(extraBookings ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-medium">
                <Gift className="h-3.5 w-3.5" />
                {extraBookings} awarded booking{extraBookings !== 1 ? 's' : ''} available
              </span>
            ) : null}
          </div>
          {bonusEarnedToday > 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              🎉 You stayed active in {bonusEarnedToday} of your booked window
              {bonusEarnedToday !== 1 ? 's' : ''} today — that earned you{' '}
              {bonusEarnedToday} extra booking{bonusEarnedToday !== 1 ? 's' : ''}. Book another window below.
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          {slots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No time slots are available for this course.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((slot, index) => {
                const avail = availabilityFor(slot);
                const cap = avail?.maxStudents ?? (slot as { maxStudents?: number }).maxStudents ?? null;
                const bookedSeats = avail?.booked ?? 0;
                const remaining = avail?.remaining ?? null;
                const isFull = remaining !== null && remaining <= 0;
                const booked = bookingFor(slot);
                // A slot closes for booking at its own start time on the study day.
                const hasStarted = !booked && slotBookingClosed(activeDate, slot.from);
                // Past the daily allowance a student may still book by drawing
                // from an instructor-awarded pool — mirrors the backend rule.
                const atLimit =
                  !booked &&
                  !hasStarted &&
                  bookedCount >= allowance &&
                  (extraBookings ?? 0) <= 0;
                const pct = cap && cap > 0 ? Math.min(100, (bookedSeats / cap) * 100) : 0;
                const nearFull = cap !== null && !isFull && pct >= 80;

                return (
                  <Card
                    key={index}
                    className={cn(
                      "border transition-all",
                      booked
                        ? "border-green-300 bg-green-50/40"
                        : isFull || atLimit || hasStarted
                          ? "opacity-70 border-muted"
                          : "hover:border-primary hover:shadow-sm"
                    )}
                  >
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <div className="font-medium">
                            <TimeDisplay time={slot.from} /> – <TimeDisplay time={slot.to} />
                          </div>
                        </div>

                        {booked ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                              <Check className="h-4 w-4" /> Booked
                            </span>
                            {booked.kind === 'BONUS' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
                                <Gift className="h-3 w-3" /> Bonus
                              </span>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => handleCancel(booked._id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy || atLimit || isFull || hasStarted}
                            onClick={() => handleBook(slot)}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : hasStarted ? (
                              'Started'
                            ) : isFull ? (
                              'Full'
                            ) : atLimit ? (
                              'Daily limit reached'
                            ) : (
                              'Book'
                            )}
                          </Button>
                        )}
                      </div>

                      {cap !== null ? (
                        <div className="space-y-1">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isFull ? "bg-red-500" : nearFull ? "bg-yellow-500" : "bg-green-500"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {isFull
                              ? 'Full — choose another window'
                              : `${remaining} seat${remaining === 1 ? '' : 's'} left`}
                            <span className="opacity-70">· {bookedSeats}/{cap} booked</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" /> No capacity limit
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex pt-2 border-t">
            <Button onClick={onClose} variant="outline" className="ml-auto" disabled={busy}>
              Done
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>• Booking for a day opens at 9:00 AM IST two days before. Each slot stays open to book right up until it starts.</p>
            <p>• Your booking allowance resets each calendar day — it counts every booking you make today, for any day.</p>
            {bonusEnabled ? (
              <p>• Stay active for most of a booked window and you'll earn a bonus booking to use the same day.</p>
            ) : null}
            <p>• Need a different window? Cancel a booking to free up your allowance, then book another.</p>
            <p>• Access to the course is allowed during a window you've booked.</p>
            <p>• Time slots are in IST (Indian Standard Time, UTC+5:30).</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
