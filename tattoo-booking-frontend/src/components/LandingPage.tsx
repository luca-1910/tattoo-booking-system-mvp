/* eslint-disable @next/next/no-img-element */
import { Instagram, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] relative overflow-hidden">
      {/* Grain texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a] z-10" />
        <div 
          className="h-[70vh] bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1651216829699-439e281e23d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXR0b28lMjBzdHVkaW8lMjBkYXJrfGVufDF8fHx8MTc2MTc0NzgyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          }}
        />
        
        {/* Hero Content */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center">
          <div className="mb-8">
            <h1 className="mb-2 tracking-tight">MissMay Tattoos</h1>
            <p className="text-[#a0a0a0] max-w-md mx-auto">
              Fine line artistry. Dark minimalism. Your story, permanently told.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button 
              onClick={() => onNavigate('booking')}
              className="bg-[#a32020] hover:bg-[#8a1b1b] text-white px-8 py-6 rounded-lg transition-all duration-300"
            >
              Book Appointment
            </Button>
            <Button 
              onClick={() => onNavigate('admin-login')}
              variant="outline"
              className="border-[#a32020] text-[#a32020] hover:bg-[#a32020]/10 px-8 py-6 rounded-lg transition-all duration-300"
            >
              Admin Login
            </Button>
          </div>

          {/* Social Links */}
          <div className="flex gap-6">
            <a 
              href="https://instagram.com/missmay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#e5e5e5] hover:text-[#a32020] transition-colors duration-300"
            >
              <Instagram className="w-5 h-5" />
              <span>Instagram</span>
            </a>
            <a 
              href="https://shop.missmay.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#e5e5e5] hover:text-[#a32020] transition-colors duration-300"
            >
              <ExternalLink className="w-5 h-5" />
              <span>Shop</span>
            </a>
          </div>
        </div>
      </div>

      {/* Portfolio Preview Section */}
      <div className="relative z-20 px-4 py-16 max-w-6xl mx-auto">
        <h2 className="text-center mb-12">Recent Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1759346771288-ac905d1b1abf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwdGF0dG9vfGVufDF8fHx8MTc2MTc0NjUzNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
              alt="Tattoo work 1" 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1605647533135-51b5906087d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXR0b28lMjBhcnRpc3QlMjB3b3Jrc3BhY2V8ZW58MXx8fHwxNzYxNzg3NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
              alt="Tattoo work 2" 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1651216829699-439e281e23d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXR0b28lMjBzdHVkaW8lMjBkYXJrfGVufDF8fHx8MTc2MTc0NzgyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
              alt="Tattoo work 3" 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-20 border-t border-[rgba(255,255,255,0.1)] py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="mb-4">Contact</h3>
            <p className="text-[#a0a0a0]">hello@missmay.com</p>
            <p className="text-[#a0a0a0]">+1 (555) 123-4567</p>
          </div>
          <div>
            <h3 className="mb-4">Studio Location</h3>
            <p className="text-[#a0a0a0]">123 Ink Street</p>
            <p className="text-[#a0a0a0]">Brooklyn, NY 11211</p>
          </div>
          <div>
            <h3 className="mb-4">Hours</h3>
            <p className="text-[#a0a0a0]">Tue - Sat: 11AM - 7PM</p>
            <p className="text-[#a0a0a0]">Sun - Mon: Closed</p>
          </div>
        </div>
        <div className="text-center mt-8 text-[#a0a0a0]">
          <p>&copy; 2025 MissMay Tattoos. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
