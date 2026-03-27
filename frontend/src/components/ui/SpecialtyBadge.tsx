import { AgentSpecialty } from '@/types';
import { cn, getSpecialtyColor, getSpecialtyLabel } from '@/lib/utils';

interface SpecialtyBadgeProps {
  specialty: AgentSpecialty;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SpecialtyBadge({ specialty, size = 'md', className }: SpecialtyBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium text-white',
        getSpecialtyColor(specialty),
        sizeClasses[size],
        className
      )}
    >
      {getSpecialtyLabel(specialty)}
    </span>
  );
}
