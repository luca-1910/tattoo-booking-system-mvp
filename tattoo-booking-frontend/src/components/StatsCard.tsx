interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

export function StatsCard({ title, value, icon, color }: StatsCardProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 border border-[rgba(255,255,255,0.1)] hover:border-[#a32020] hover:shadow-lg hover:shadow-[#a32020]/5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#a0a0a0] mb-2">{title}</p>
          <p className="text-[#e5e5e5]">{value}</p>
        </div>
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
