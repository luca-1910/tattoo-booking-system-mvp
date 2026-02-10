/* eslint-disable @next/next/no-img-element */
"use client";

import { Check, X, Calendar, Image as ImageIcon, ExternalLink as ExternalLinkIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface Booking {
  id: string | number;
  clientName: string;
  email: string;
  phone: string;
  tattooIdea: string;
  date: string;
  time: string;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled" | "expired";
  hasImages: boolean;
  imageCount?: number;

  // URLs passed from Dashboard mapping
  paymentProofUrl?: string | null;
  referenceImageUrl?: string | null;
}

interface BookingCardProps {
  booking: Booking;
  onApprove: (id: string | number) => void;
  onReject: (id: string | number) => void;
}

export function BookingCard({ booking, onApprove, onReject }: BookingCardProps) {
  const statusColors: Record<Booking["status"], string> = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    expired: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  const paymentUrl = booking.paymentProofUrl ?? "";
  const paymentIsPdf =
    paymentUrl.toLowerCase().includes(".pdf") ||
    paymentUrl.toLowerCase().includes("application%2Fpdf");

  return (
    <Dialog>
      {/* Card is clickable */}
      <DialogTrigger asChild>
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)] hover:border-[#a32020] hover:shadow-lg hover:shadow-[#a32020]/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="mb-1">{booking.clientName}</h3>
              <p className="text-[#a0a0a0]">{booking.email}</p>
              <p className="text-[#a0a0a0]">{booking.phone}</p>
            </div>
            <Badge className={statusColors[booking.status]}>{booking.status}</Badge>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <p className="text-[#a0a0a0] mb-1">Tattoo Idea</p>
              <p className="text-[#e5e5e5] line-clamp-3">{booking.tattooIdea}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#a0a0a0]">
                <Calendar className="w-4 h-4" />
                <span>
                  {booking.date} at {booking.time}
                </span>
              </div>

              {booking.hasImages && (
                <div className="flex items-center gap-2 text-[#a0a0a0]">
                  <ImageIcon className="w-4 h-4" />
                  <span>{booking.imageCount} images</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions (same UI); stopPropagation so clicking buttons doesn't open modal */}
          {booking.status === "pending" && (
            <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
              <Button
                onClick={() => onApprove(booking.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>

              <Button
                onClick={() => onReject(booking.id)}
                variant="outline"
                className="flex-1 border-red-500/20 text-red-500 hover:bg-red-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </DialogTrigger>

      {/* Modal */}
      <DialogContent className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-[#e5e5e5] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#e5e5e5]">
            {booking.clientName} — {booking.date} at {booking.time}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tattoo idea text */}
          <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[rgba(255,255,255,0.08)]">
            <p className="text-[#a0a0a0] text-sm mb-2">Tattoo Idea</p>
            <p className="text-[#e5e5e5] whitespace-pre-wrap">{booking.tattooIdea || "-"}</p>
          </div>

          {/* Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment proof */}
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#a0a0a0] text-sm">Payment Proof</p>
                {booking.paymentProofUrl && (
                  <a
                    href={booking.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#a0a0a0] hover:text-white inline-flex items-center gap-1"
                  >
                    Open <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                )}
              </div>

              {!booking.paymentProofUrl ? (
                <p className="text-[#a0a0a0]">No payment proof attached.</p>
              ) : paymentIsPdf ? (
                <div className="text-[#a0a0a0] text-sm">
                  Payment proof is a PDF.{" "}
                  <a
                    href={booking.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-white"
                  >
                    Open PDF
                  </a>
                </div>
              ) : (
                <img
                  src={booking.paymentProofUrl}
                  alt="Payment proof"
                  className="w-full rounded-md border border-[rgba(255,255,255,0.08)]"
                />
              )}
            </div>

            {/* Reference image */}
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#a0a0a0] text-sm">Reference Image</p>
                {booking.referenceImageUrl && (
                  <a
                    href={booking.referenceImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#a0a0a0] hover:text-white inline-flex items-center gap-1"
                  >
                    Open <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                )}
              </div>

              {booking.referenceImageUrl ? (
                <img
                  src={booking.referenceImageUrl}
                  alt="Reference"
                  className="w-full rounded-md border border-[rgba(255,255,255,0.08)]"
                />
              ) : (
                <p className="text-[#a0a0a0]">No reference image attached.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
