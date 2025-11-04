import { Check, X, Image as ImageIcon, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Booking {
  id: number;
  clientName: string;
  email: string;
  phone: string;
  tattooIdea: string;
  date: string;
  time: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'expired';
  hasImages: boolean;
  imageCount?: number;
}

interface BookingCardProps {
  booking: Booking;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export function BookingCard({ booking, onApprove, onReject }: BookingCardProps) {
  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-500 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    expired: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)] hover:border-[#a32020] hover:shadow-lg hover:shadow-[#a32020]/10 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="mb-1">{booking.clientName}</h3>
          <p className="text-[#a0a0a0]">{booking.email}</p>
          <p className="text-[#a0a0a0]">{booking.phone}</p>
        </div>
        <Badge className={statusColors[booking.status]}>
          {booking.status}
        </Badge>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-[#a0a0a0] mb-1">Tattoo Idea</p>
          <p className="text-[#e5e5e5]">{booking.tattooIdea}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#a0a0a0]">
            <Calendar className="w-4 h-4" />
            <span>{booking.date} at {booking.time}</span>
          </div>
          {booking.hasImages && (
            <div className="flex items-center gap-2 text-[#a0a0a0]">
              <ImageIcon className="w-4 h-4" />
              <span>{booking.imageCount} images</span>
            </div>
          )}
        </div>
      </div>

      {booking.status === 'pending' && (
        <div className="flex gap-3">
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
  );
}
