import React from 'react';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

interface ClockTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export const ClockTimePicker: React.FC<ClockTimePickerProps> = ({ value, onChange, label }) => {
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="max-w-[16rem] mx-auto">
      <Label htmlFor={`${label.toLowerCase().replace(' ', '-')}`} className="block mb-2 text-sm font-medium text-foreground">
        {label}:
      </Label>
      <div className="relative">
        <div className="absolute inset-y-0 right-0 top-0 flex items-center pr-3 pointer-events-none">
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        <input
          type="time"
          id={`${label.toLowerCase().replace(' ', '-')}`}
          className="block w-full p-2.5 bg-card border border-input text-card-foreground text-sm rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
          min="09:00"
          max="18:00"
          value={value || ''}
          onChange={handleTimeChange}
          required
        />
      </div>
    </div>
  );
};
