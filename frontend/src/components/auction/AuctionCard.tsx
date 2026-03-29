import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { AuctionWithJob } from '@/types';
import { cn, formatCredits, calculateBudgetPercentage, getSpecialtyBorderColor } from '@/lib/utils';
import { SpecialtyBadge, CountdownTimer, ProgressBar } from '@/components/ui';
import { BidHistoryModal } from './BidHistoryModal';

interface AuctionCardProps {
  auction: AuctionWithJob;
  onExpire?: () => void;
  className?: string;
}

export function AuctionCard({ auction, onExpire, className }: AuctionCardProps) {
  const [showBidHistory, setShowBidHistory] = useState(false);
  const budgetPercentage = auction.lowest_bid
    ? calculateBudgetPercentage(auction.lowest_bid, auction.job_base_price)
    : 100;

  const leadingBidder = auction.lowest_bid ? 'Agent' : null; // Would come from API

  return (
    <div
      className={cn(
        'card-hover relative overflow-hidden border-l-4',
        getSpecialtyBorderColor(auction.job_specialty),
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <SpecialtyBadge specialty={auction.job_specialty} size="sm" />
          <CountdownTimer endTime={auction.ends_at} onExpire={onExpire} size="sm" />
        </div>
      </div>

      {/* Title & Description */}
      <Link to={`/auctions/${auction.id}`} className="block group">
        <h3 className="font-semibold text-text-primary group-hover:text-accent-purple transition-colors mb-1 line-clamp-1">
          {auction.job_title}
        </h3>
        <p className="text-sm text-text-secondary line-clamp-2 mb-3">
          {auction.job_description}
        </p>
      </Link>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-sm text-text-muted mb-3">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>{auction.bid_count} bidders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary">Budget:</span>
          <span className="text-text-primary font-medium">{formatCredits(auction.job_base_price)}</span>
        </div>
      </div>

      {/* Current Lead */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-muted">Current lead</span>
        <span className="text-lg font-semibold text-text-primary">
          {auction.lowest_bid ? formatCredits(auction.lowest_bid) : '—'}
        </span>
      </div>

      {/* Budget Progress */}
      <ProgressBar
        value={100 - budgetPercentage}
        label={leadingBidder || undefined}
        showPercentage
        color={budgetPercentage <= 50 ? 'green' : budgetPercentage <= 80 ? 'orange' : 'purple'}
        size="sm"
      />

      {/* Bid History Link */}
      <div className="mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setShowBidHistory(true)}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Bid history ({auction.bid_count})
        </button>
      </div>

      {/* Bid History Modal */}
      <BidHistoryModal
        auction={auction}
        isOpen={showBidHistory}
        onClose={() => setShowBidHistory(false)}
      />
    </div>
  );
}
