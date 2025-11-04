/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Upload, Check, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

interface BookingPageProps {
  onNavigate: (page: string) => void;
}

/* ──────────────────────────────────────────────────────────
   Supabase client + helpers
────────────────────────────────────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function uploadToIntake(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from('intake-uploads').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('intake-uploads').getPublicUrl(path);
  return data.publicUrl as string;
}

type SlotRow = {
  slot_id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  status: 'Available' | 'Booked' | 'Blocked' | 'Completed' | 'Cancelled';
};

function formatTimeLabel(iso: string) {
  const dt = new Date(iso);
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/* ────────────────────────────────────────────────────────── */

export function BookingPage({ onNavigate }: BookingPageProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    tattooIdea: '',
    referenceImages: [] as File[],
    paymentProof: null as File | null,
    selectedDate: undefined as Date | undefined,
    selectedTime: '',
  });

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [paymentPreview, setPaymentPreview] = useState<string>('');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleReferenceImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, referenceImages: files }));
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, paymentProof: file }));
      setPaymentPreview(URL.createObjectURL(file));
    }
  };

  /* ────────────────────────────────────────────────────────
     Dynamic slots: fetch from DB and filter by selected date
  ───────────────────────────────────────────────────────── */
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

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
        .limit(300);

      if (!active) return;
      if (error) {
        // If you see a "schema cache" error, add artist_core to Exposed Schemas in Supabase API settings.
        toast.error(error.message);
      } else {
        setSlots((data as SlotRow[]) ?? []);
      }
      setSlotsLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Build the time options for the currently selected date (Step 4)
  const timeSlotsForSelectedDate = useMemo(() => {
    if (!formData.selectedDate) return [];
    const dayStr = formData.selectedDate.toDateString();
    return slots
      .filter(s => new Date(s.start_time).toDateString() === dayStr)
      .map(s => formatTimeLabel(s.start_time));
  }, [slots, formData.selectedDate]);

  // Find the selected slot_id from selectedDate + selectedTime (at submit)
  function resolveRequestedSlotId(): string | null {
    if (!formData.selectedDate || !formData.selectedTime) return null;
    const dayStr = formData.selectedDate.toDateString();
    const match = slots.find(s =>
      new Date(s.start_time).toDateString() === dayStr &&
      formatTimeLabel(s.start_time) === formData.selectedTime
    );
    return match?.slot_id ?? null;
  }

  /* ────────────────────────────────────────────────────────
     Submit to Supabase (keeps your UI/steps intact)
  ───────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    try {
      if (!formData.paymentProof) {
        toast.error('Please attach your payment proof.');
        return;
      }
      if (!formData.selectedDate || !formData.selectedTime) {
        toast.error('Please choose a date and time.');
        return;
      }

      setSubmitting(true);

      // Upload required payment proof
      const payment_proof_url = await uploadToIntake(formData.paymentProof, 'proofs');

      // Optional: take the first reference image (schema has a single URL)
      let reference_image_url: string | null = null;
      if (formData.referenceImages.length > 0) {
        reference_image_url = await uploadToIntake(formData.referenceImages[0], 'refs');
      }

      // Resolve requested slot id from the already-fetched list
      const requested_slot_id = resolveRequestedSlotId();
      if (!requested_slot_id) {
        toast.message('No exact slot found at that time — submitting without a slot. The artist will follow up.');
      }

      const { error: insErr } = await supabase
        .from('public_intake.booking_request')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          tattoo_idea: formData.tattooIdea || null,
          reference_image_url,
          payment_proof_url,
          requested_slot_id,
          status: 'pending',
        });

      if (insErr) throw insErr;

      toast.success('Booking request submitted successfully! You will receive a confirmation email shortly.');
      setTimeout(() => onNavigate('home'), 2000);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Something went wrong submitting your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => step === 1 ? onNavigate('home') : setStep(step - 1)}
            className="mb-4 text-[#e5e5e5] hover:text-[#a32020]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="mb-2">Book Your Tattoo</h1>
          <p className="text-[#a0a0a0]">Step {step} of {totalSteps}</p>

          {/* Progress Bar */}
          <div className="mt-4 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#a32020] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step 1: Personal Details */}
        {step === 1 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Personal Details</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your.email@example.com"
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                />
              </div>

              <div>
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleInputChange('dob', e.target.value)}
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                />
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.email || !formData.phone || !formData.dob}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Tattoo Details */}
        {step === 2 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Tattoo Details</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="tattooIdea">Describe Your Tattoo Idea *</Label>
                <Textarea
                  id="tattooIdea"
                  value={formData.tattooIdea}
                  onChange={(e) => handleInputChange('tattooIdea', e.target.value)}
                  placeholder="Tell me about your tattoo idea, placement, size, and any specific details..."
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5] min-h-[150px]"
                />
              </div>

              <div>
                <Label htmlFor="referenceImages">Reference Images (Optional)</Label>
                <div className="mt-2">
                  <label
                    htmlFor="referenceImages"
                    className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:border-[#a32020] transition-colors"
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-[#a0a0a0]" />
                      <p className="text-[#a0a0a0]">Click to upload images</p>
                    </div>
                    <input
                      id="referenceImages"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleReferenceImagesUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {previewUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="aspect-square rounded-lg overflow-hidden">
                        <img src={url} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => setStep(3)}
              disabled={!formData.tattooIdea}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Payment & Date Selection */}
        {step === 3 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Payment & Scheduling</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="paymentProof">Upload Payment Proof *</Label>
                <p className="text-[#a0a0a0] mt-1 mb-2">Please submit deposit payment before booking</p>
                <label
                  htmlFor="paymentProof"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:border-[#a32020] transition-colors"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[#a0a0a0]" />
                    <p className="text-[#a0a0a0]">Click to upload payment screenshot</p>
                  </div>
                  <input
                    id="paymentProof"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handlePaymentProofUpload}
                    className="hidden"
                  />
                </label>

                {paymentPreview && (
                  <div className="mt-4 w-full max-w-xs mx-auto rounded-lg overflow-hidden">
                    <img src={paymentPreview} alt="Payment proof" className="w-full h-auto" />
                  </div>
                )}
              </div>

              <div>
                <Label>Preferred Date *</Label>
                <div className="mt-2 bg-[#0a0a0a] rounded-lg p-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={formData.selectedDate}
                    onSelect={(date) => handleInputChange('selectedDate', date)}
                    className="rounded-md border-0"
                    disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 1}
                  />
                </div>
                {slotsLoading && (
                  <p className="text-xs text-[#a0a0a0] mt-2">Loading available slots…</p>
                )}
              </div>
            </div>

            <Button
              onClick={() => setStep(4)}
              disabled={!formData.paymentProof || !formData.selectedDate}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Time Selection & Confirmation */}
        {step === 4 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Select Time Slot</h2>

            <div>
              <Label>
                {formData.selectedDate
                  ? `Available Times on ${formData.selectedDate.toLocaleDateString()}`
                  : 'Available Times'}
              </Label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {timeSlotsForSelectedDate.length === 0 && (
                  <p className="col-span-2 text-[#a0a0a0]">No times available for this date.</p>
                )}
                {timeSlotsForSelectedDate.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleInputChange('selectedTime', time)}
                    className={`p-3 rounded-lg border transition-all ${
                      formData.selectedTime === time
                        ? 'bg-[#a32020] border-[#a32020] text-white'
                        : 'bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5] hover:border-[#a32020]'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-lg p-4 space-y-2">
              <h3>Booking Summary</h3>
              <div className="text-[#a0a0a0] space-y-1">
                <p><span className="text-[#e5e5e5]">Name:</span> {formData.name}</p>
                <p><span className="text-[#e5e5e5]">Email:</span> {formData.email}</p>
                <p><span className="text-[#e5e5e5]">Date:</span> {formData.selectedDate?.toLocaleDateString()}</p>
                <p><span className="text-[#e5e5e5]">Time:</span> {formData.selectedTime}</p>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!formData.selectedTime || submitting}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting…' : 'Submit Booking Request'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Provide default export in case your router expects it
export default BookingPage;
