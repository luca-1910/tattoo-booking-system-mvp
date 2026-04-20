/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Upload,
  Check,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Calendar } from "./ui/calendar";
import { toast } from "sonner";
import { type SlotStatus } from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

interface BookingPageProps {
  onNavigate: (page: string) => void;
}

/* ──────────────────────────────────────────────────────────
   Supabase client (PUBLIC schema only)
────────────────────────────────────────────────────────── */
const supabase = supabaseBrowser();

/**
 * Uploads a file to a public bucket and returns a public URL.
 * NOTE: Ensure you have a bucket named "intake-uploads" and it allows inserts.
 */
async function uploadToIntake(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage
    .from("intake-uploads")
    .upload(path, file, { upsert: false });

  if (error) {
    
    // Make it a standard Error so it shows up properly
    throw new Error(`Storage upload failed: ${error.message}`);
  } 

  const { data } = supabase.storage.from("intake-uploads").getPublicUrl(path);
  return data.publicUrl as string;
} 


type SlotRow = {
  slot_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  status: SlotStatus;
};

function formatTimeLabel(iso: string) {
  const dt = new Date(iso);
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Stable local date key: YYYY-MM-DD (prevents "toDateString" quirks)
function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDateFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Construct in local time
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ────────────────────────────────────────────────────────── */

export function BookingPage({ onNavigate }: BookingPageProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    tattooIdea: "",
    referenceImages: [] as File[],
    paymentProof: null as File | null,

    // New dropdown-driven selection
    selectedDateKey: "", // YYYY-MM-DD
    selectedTime: "", // "h:mm AM/PM"
  });

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [paymentPreview, setPaymentPreview] = useState<string>("");

  // Inline validation errors for step 1 fields
  const [step1Errors, setStep1Errors] = useState<{ name?: string; email?: string }>({});

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the corresponding inline error as soon as the user edits that field
    if (field === "name" || field === "email") {
      setStep1Errors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /** Validates step-1 fields and advances to step 2, or surfaces inline errors. */
  const handleStep1Continue = () => {
    const errors: { name?: string; email?: string } = {};

    if (formData.name.length > 200) {
      errors.name = "Name must be 200 characters or fewer.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      return;
    }

    setStep1Errors({});
    setStep(2);
  };

  const handleReferenceImagesUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    setFormData((prev) => ({ ...prev, referenceImages: files }));
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, paymentProof: file }));
      setPaymentPreview(URL.createObjectURL(file));
    }
  };

  /* ────────────────────────────────────────────────────────
     Slots: fetch from DB (public.slot) where status=available
  ───────────────────────────────────────────────────────── */
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      setSlotsLoading(true);

      const { data, error } = await supabase
        .from("slot")
        .select("slot_id,start_time,end_time,status")
        .gte("start_time", new Date().toISOString())
        .eq("status", "available")
        .order("start_time", { ascending: true })
        .limit(500);

      if (!active) return;

      if (error) {
        toast.error(error.message);
        setSlots([]);
      } else {
        setSlots(((data as SlotRow[]) ?? []).filter(Boolean));
      }

      setSlotsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Build available date options from slots
  const availableDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      const dk = toLocalDateKey(new Date(s.start_time));
      set.add(dk);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [slots]);

  // Build time options filtered by selected date
  const availableTimesForSelectedDate = useMemo(() => {
    if (!formData.selectedDateKey) return [];

    return slots
      .filter(
        (s) =>
          toLocalDateKey(new Date(s.start_time)) === formData.selectedDateKey,
      )
      .map((s) => formatTimeLabel(s.start_time));
  }, [slots, formData.selectedDateKey]);

  // Resolve slot_id from dateKey + selectedTime
  function resolveRequestedSlotId(): string | null {
    if (!formData.selectedDateKey || !formData.selectedTime) return null;

    const match = slots.find((s) => {
      const dk = toLocalDateKey(new Date(s.start_time));
      return (
        dk === formData.selectedDateKey &&
        formatTimeLabel(s.start_time) === formData.selectedTime
      );
    });

    return match?.slot_id ?? null;
  }

  /* ────────────────────────────────────────────────────────
     Submit booking request (public.booking_request)
  ───────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    try {
      if (!formData.paymentProof) {
        toast.error("Please attach your payment proof.");
        return;
      }
      if (!formData.selectedDateKey || !formData.selectedTime) {
        toast.error("Please choose a date and time.");
        return;
      }

      setSubmitting(true);

      // Upload payment proof (required)
      const payment_proof_url = await uploadToIntake(
        formData.paymentProof,
        "proofs",
      );

      // Optional: store only first reference image (schema supports single url)
      let reference_image_url: string | null = null;
      if (formData.referenceImages.length > 0) {
        reference_image_url = await uploadToIntake(
          formData.referenceImages[0],
          "refs",
        );
      }

      // Resolve slot_id (should exist because dropdowns come from slots)
      const requested_slot_id = resolveRequestedSlotId();
      if (!requested_slot_id) {
        toast.error(
          "Selected slot could not be found. Please reselect date/time.",
        );
        return;
      }

      const res = await fetch("/api/bookings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          dob: formData.dob || null,
          tattoo_idea: formData.tattooIdea || null,
          reference_image_url,
          payment_proof_url,
          slot_id: requested_slot_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong submitting your request.");
      }

      toast.success(
        "Booking request submitted! Check your email for a confirmation.",
      );
      setTimeout(() => onNavigate("home"), 1500);
    } catch (e: any) {
      toast.error(
        e?.message || e?.error_description || "Something went wrong submitting your request.",
      );
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
            onClick={() =>
              step === 1 ? onNavigate("home") : setStep(step - 1)
            }
            className="mb-4 text-[#e5e5e5] hover:text-[#a32020]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="mb-2">Book Your Tattoo</h1>
          <p className="text-[#a0a0a0]">
            Step {step} of {totalSteps}
          </p>

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
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                  aria-describedby={step1Errors.name ? "name-error" : undefined}
                />
                {step1Errors.name && (
                  <p id="name-error" className="mt-1 text-sm text-red-400">
                    {step1Errors.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="your.email@example.com"
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                  aria-describedby={step1Errors.email ? "email-error" : undefined}
                />
                {step1Errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-400">
                    {step1Errors.email}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
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
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                />
              </div>
            </div>

            <Button
              onClick={handleStep1Continue}
              disabled={
                !formData.name ||
                !formData.email ||
                !formData.phone ||
                !formData.dob
              }
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
                  onChange={(e) =>
                    handleInputChange("tattooIdea", e.target.value)
                  }
                  placeholder="Tell me about your tattoo idea, placement, size, and any specific details..."
                  className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5] min-h-[150px]"
                />
              </div>

              <div>
                <Label htmlFor="referenceImages">
                  Reference Images (Optional)
                </Label>
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
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
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

        {/* Step 3: Payment & Date Selection (Dropdown) */}
        {step === 3 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Payment & Scheduling</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="paymentProof">Upload Payment Proof *</Label>
                <p className="text-[#a0a0a0] mt-1 mb-2">
                  Please submit deposit payment before booking
                </p>
                <label
                  htmlFor="paymentProof"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:border-[#a32020] transition-colors"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[#a0a0a0]" />
                    <p className="text-[#a0a0a0]">
                      Click to upload payment screenshot
                    </p>
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
                    <img
                      src={paymentPreview}
                      alt="Payment proof"
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="dateDropdown">Preferred Date *</Label>

                <div className="mt-2">
                  <select
                    id="dateDropdown"
                    value={formData.selectedDateKey}
                    onChange={(e) => {
                      // Changing date should clear selected time
                      handleInputChange("selectedDateKey", e.target.value);
                      handleInputChange("selectedTime", "");
                    }}
                    disabled={slotsLoading || availableDateKeys.length === 0}
                    className="w-full h-11 rounded-md px-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#a32020]"
                  >
                    <option value="">
                      {slotsLoading
                        ? "Loading available dates..."
                        : availableDateKeys.length === 0
                          ? "No available dates"
                          : "Select a date"}
                    </option>

                    {availableDateKeys.map((dk) => (
                      <option key={dk} value={dk}>
                        {prettyDateFromKey(dk)}
                      </option>
                    ))}
                  </select>

                  {availableDateKeys.length === 0 && !slotsLoading && (
                    <p className="text-xs text-[#a0a0a0] mt-2">
                      There are currently no available slots. Please check back
                      later.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep(4)}
              disabled={!formData.paymentProof || !formData.selectedDateKey}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Time Selection (Dropdown) & Confirmation */}
        {step === 4 && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-6">
            <h2>Select Time Slot</h2>

            <div className="space-y-3">
              <Label htmlFor="timeDropdown">
                {formData.selectedDateKey
                  ? `Available Times on ${prettyDateFromKey(formData.selectedDateKey)}`
                  : "Available Times"}
              </Label>

              <select
                id="timeDropdown"
                value={formData.selectedTime}
                onChange={(e) =>
                  handleInputChange("selectedTime", e.target.value)
                }
                disabled={
                  !formData.selectedDateKey ||
                  availableTimesForSelectedDate.length === 0
                }
                className="w-full h-11 rounded-md px-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#a32020]"
              >
                <option value="">
                  {!formData.selectedDateKey
                    ? "Select a date first"
                    : availableTimesForSelectedDate.length === 0
                      ? "No times available for this date"
                      : "Select a time"}
                </option>

                {availableTimesForSelectedDate.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>

              {formData.selectedDateKey &&
                availableTimesForSelectedDate.length === 0 && (
                  <p className="text-xs text-[#a0a0a0]">
                    This date has no available times. Go back and choose another
                    date.
                  </p>
                )}
            </div>

            <div className="bg-[#0a0a0a] rounded-lg p-4 space-y-2">
              <h3>Booking Summary</h3>
              <div className="text-[#a0a0a0] space-y-1">
                <p>
                  <span className="text-[#e5e5e5]">Name:</span> {formData.name}
                </p>
                <p>
                  <span className="text-[#e5e5e5]">Email:</span>{" "}
                  {formData.email}
                </p>
                <p>
                  <span className="text-[#e5e5e5]">Date:</span>{" "}
                  {formData.selectedDateKey
                    ? prettyDateFromKey(formData.selectedDateKey)
                    : "-"}
                </p>
                <p>
                  <span className="text-[#e5e5e5]">Time:</span>{" "}
                  {formData.selectedTime || "-"}
                </p>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!formData.selectedTime || submitting}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              {submitting ? "Submitting…" : "Submit Booking Request"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Default export for routing
export default BookingPage;
