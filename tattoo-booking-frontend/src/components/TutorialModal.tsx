"use client";

import { useState } from "react";
import { X, ArrowRight, ArrowLeft, CheckCircle2, LayoutDashboard, Calendar, Settings, Globe, BookOpen } from "lucide-react";
import { Button } from "./ui/button";

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: <BookOpen className="w-8 h-8 text-[#a32020]" />,
    title: "Welcome to your studio dashboard",
    description:
      "This quick tour covers the key areas of your admin panel. You can replay it any time from Settings → Tutorial.",
  },
  {
    icon: <LayoutDashboard className="w-8 h-8 text-[#a32020]" />,
    title: "Manage booking requests",
    description:
      "The Dashboard is where client requests land. Review each one, then approve or reject it. Approved sessions can sync automatically to Google Calendar.",
  },
  {
    icon: <Calendar className="w-8 h-8 text-[#a32020]" />,
    title: "Your schedule at a glance",
    description:
      "The Calendar shows all approved sessions in a monthly grid. Use it to spot gaps or conflicts before accepting new requests.",
  },
  {
    icon: <Settings className="w-8 h-8 text-[#a32020]" />,
    title: "Customise your presence",
    description:
      "In Settings you can update your profile, studio hours, social links, and the hero & portfolio images shown on your landing page.",
  },
  {
    icon: <Globe className="w-8 h-8 text-[#a32020]" />,
    title: "You're all set",
    description:
      "Your public booking page is live. Share the link with clients and start accepting sessions. The URL follows the pattern shown in your browser when you visit the home page.",
  },
];

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl p-8">
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#a0a0a0] hover:text-[#e5e5e5] transition-colors"
          aria-label="Close tutorial"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-[#a32020]" : "bg-[rgba(255,255,255,0.1)]"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-[#a32020]/10 rounded-2xl flex items-center justify-center mb-6">
          {current.icon}
        </div>

        {/* Content */}
        <h2 className="text-xl font-semibold text-[#e5e5e5] mb-3">{current.title}</h2>
        <p className="text-[#a0a0a0] text-sm leading-relaxed">{current.description}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className="text-[#a0a0a0] hover:text-[#e5e5e5] disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {isLast ? (
            <Button
              onClick={handleClose}
              className="bg-[#a32020] hover:bg-[#8a1b1b] text-white px-6"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Get started
            </Button>
          ) : (
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="bg-[#a32020] hover:bg-[#8a1b1b] text-white px-6"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
