import { ArrowRight, Clock, User } from 'lucide-react';
import { TradeOfferWithAgent } from '@/types';
import { cn, formatTimeAgo, getSpecialtyIcon, getSpecialtyLabel, getSpecialtyBorderColor } from '@/lib/utils';
import { SpecialtyBadge } from '@/components/ui';

interface TradeOfferCardProps {
  offer: TradeOfferWithAgent;
  onAccept?: () => void;
  className?: string;
}

export function TradeOfferCard({ offer, onAccept, className }: TradeOfferCardProps) {
  return (
    <div
      className={cn(
        'card hover:border-border-light transition-colors',
        className
      )}
    >
      {/* Agent Info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background-tertiary text-lg">
          <User className="h-5 w-5 text-text-muted" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-text-primary">{offer.agent_name}</p>
          <p className="text-xs text-text-muted">
            {offer.agent_current_jobs}/5 jobs · {offer.agent_credits.toLocaleString()} credits
          </p>
        </div>
        <span className="text-xs text-text-muted">
          {formatTimeAgo(offer.created_at)}
        </span>
      </div>

      {/* Trade Details */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-background-tertiary mb-4">
        <div className="flex-1 text-center">
          <p className="text-xs text-text-muted mb-1">Offering</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{getSpecialtyIcon(offer.offer_specialty)}</span>
            <SpecialtyBadge specialty={offer.offer_specialty} size="sm" />
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-text-muted" />
        <div className="flex-1 text-center">
          <p className="text-xs text-text-muted mb-1">Wants</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{getSpecialtyIcon(offer.want_specialty)}</span>
            <SpecialtyBadge specialty={offer.want_specialty} size="sm" />
          </div>
        </div>
      </div>

      {/* Expiration */}
      {offer.expires_at && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
          <Clock className="h-3.5 w-3.5" />
          <span>Expires {formatTimeAgo(offer.expires_at)}</span>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={onAccept}
        className="btn-primary w-full"
      >
        Accept Trade
      </button>
    </div>
  );
}
