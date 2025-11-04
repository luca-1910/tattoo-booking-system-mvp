// /components/SlotSelect.tsx
'use client';
import React from 'react';

export default function SlotSelect({
  dates,
  times,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  disabled,
}: {
  dates: string[];
  times: string[];
  selectedDate: string;
  selectedTime: string;
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm mb-1">Date</label>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={selectedDate}
          onChange={(e) => { onDateChange(e.target.value); onTimeChange(''); }}
          disabled={disabled || dates.length === 0}
        >
          <option value="">{disabled ? 'Loading dates…' : 'Select a date'}</option>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Time</label>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={selectedTime}
          onChange={(e) => onTimeChange(e.target.value)}
          disabled={!selectedDate || times.length === 0}
        >
          <option value="">
            {selectedDate ? (times.length ? 'Select a time' : 'No times available') : 'Select a date first'}
          </option>
          {times.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}
