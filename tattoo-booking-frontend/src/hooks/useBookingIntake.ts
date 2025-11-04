// /hooks/useBookingIntake.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type SlotRow = {
  slot_id: string;
  start_time: string;
  end_time: string;
  status: 'Available' | 'Booked' | 'Blocked' | 'Completed' | 'Cancelled';
};

export type BookingFormValues = {
  name: string;
  email: string;
  phone?: string | null;
  tattooIdea?: string | null;
  paymentProof: File;               // required
  referenceImage?: File | null;     // optional
};

async function uploadToIntake(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from('intake-uploads')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('intake-uploads').getPublicUrl(path);
  return data.publicUrl as string;
}

// '10:00 AM' -> 24h
function parseTimeLabel(label: string) {
  const [t, mer] = label.trim().split(' ');
  let [h, m] = t.split(':').map(Number);
  const upper = (mer || '').toUpperCase();
  if (upper === 'PM' && h !== 12) h += 12;
  if (upper === 'AM' && h === 12) h = 0;
  return { h, m };
}

export function useBookingIntake() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  // Slot state
  const [slots, setSlots]       = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(''); // Date.toDateString()
  const [selectedTime, setSelectedTime] = useState<string>(''); // e.g. "10:00 AM"

  // Fetch upcoming available slots
  useEffect(() => {
    let active = true;
    (async () => {
      setSlotsLoading(true);
      const { data, error } = await supabase
        .from('artist_core.slot')
        .select('slot_id,start_time,end_time,status')
        .gte('start_time', new Date().toISOString())
        .eq('status', 'Available')
        .order('start_time', { ascending: true })
        .limit(200);

      if (!active) return;
      if (error) setError(error.message);
      else setSlots((data as SlotRow[]) ?? []);
      setSlotsLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const dates = useMemo(() => {
    const set = new Set(slots.map(s => new Date(s.start_time).toDateString()));
    return Array.from(set);
  }, [slots]);

  const timesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return slots
      .filter(s => new Date(s.start_time).toDateString() === selectedDate)
      .map(s => {
        const dt = new Date(s.start_time);
        let h = dt.getHours();
        const mm = dt.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mm} ${ampm}`;
      });
  }, [slots, selectedDate]);

  async function submit(values: BookingFormValues) {
    setError(null);
    setNotice(null);

    if (!values.name || !values.email) {
      setError('Please fill in your name and email.');
      return;
    }
    if (!values.paymentProof) {
      setError('Please attach your payment proof.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError('Please choose a date and time.');
      return;
    }

    setLoading(true);
    try {
      // 1) Upload files
      const payment_proof_url = await uploadToIntake(values.paymentProof, 'proofs');
      let reference_image_url: string | null = null;
      if (values.referenceImage) {
        reference_image_url = await uploadToIntake(values.referenceImage, 'refs');
      }

      // 2) Find matching slot (if any)
      const { h, m } = parseTimeLabel(selectedTime);
      const start = new Date(selectedDate);
      start.setHours(h, m, 0, 0);
      const startISO = start.toISOString();

      const { data: slotRow, error: slotErr } = await supabase
        .from('artist_core.slot')
        .select('slot_id,status')
        .eq('start_time', startISO)
        .eq('status', 'Available')
        .maybeSingle();

      if (slotErr) throw slotErr;
      const requested_slot_id = (slotRow as any)?.slot_id ?? null;
      if (!requested_slot_id) {
        setNotice('No exact slot found—submitting without a slot. The artist will follow up.');
      }

      // 3) Insert intake row
      const { error: insErr } = await supabase
        .from('public_intake.booking_request')
        .insert({
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          tattoo_idea: values.tattooIdea || null,
          reference_image_url,
          payment_proof_url,
          requested_slot_id,
          status: 'pending',
        });

      if (insErr) throw insErr;

      setNotice('✅ Booking request submitted! We’ll be in touch soon.');
      return true;
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Something went wrong submitting your request.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
    // actions
    submit,
    setSelectedDate,
    setSelectedTime,

    // state
    loading, error, notice,
    slotsLoading, dates, timesForSelectedDate,
    selectedDate, selectedTime,
  };
}
