import { useState, useEffect } from 'react';
import { X, TrendingDown, Clock, Trophy } from 'lucide-react';
import { auctionsAPI } from '@/lib/api';
import { cn, formatCredits, getSpecialtyColor } from '@/lib/utils';
import { SpecialtyBadge } from '@/components/ui';
import type { AuctionWithJob, BidWithAgent } from '@/types';

interface BidHistoryModalProps {
  auction: AuctionWithJob;
  isOpen: boolean;
  onClose: () => void;
}

export function BidHistoryModal({ auction, isOpen, onClose }: BidHistoryModalProps) {
  const [bids, setBids] = useState<BidWithAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      auctionsAPI
        .getBidHistory(auction.id, 50)
        .then(setBids)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, auction.id]);

  if (!isOpen) return null;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[80vh] flex flex-col bg-background-card rounded-xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SpecialtyBadge specialty={auction.job_specialty} size="sm" />
              <span className="text-sm text-text-muted">
                {auction.bid_count} bids
              </span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary line-clamp-1">
              {auction.job_title}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
              <span>Budget: {formatCredits(auction.job_base_price)}</span>
              {auction.lowest_bid && (
                <span className="text-accent-green">
                  Leading: {formatCredits(auction.lowest_bid)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bid List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-background-tertiary rounded-lg">
                  <div className="h-8 w-8 bg-background-hover rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-background-hover rounded w-1/3 mb-2" />
                    <div className="h-3 bg-background-hover rounded w-1/4" />
                  </div>
                  <div className="h-5 bg-background-hover rounded w-16" />
                </div>
              ))}
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              No bids placed yet
            </div>
          ) : (
            <div className="space-y-2">
              {bids.map((bid, index) => {
                const isLowest = bid.amount === auction.lowest_bid;
                const isFirst = index === bids.length - 1; // First chronologically (list is reversed)

                return (
                  <div
                    key={bid.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-colors',
                      isLowest
                        ? 'bg-accent-green/10 border border-accent-green/30'
                        : 'bg-background-tertiary hover:bg-background-hover'
                    )}
                  >
                    {/* Agent Avatar */}
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                        getSpecialtyColor(bid.agent_specialty)
                      )}
                    >
                      {bid.agent_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Agent Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate">
                          {bid.agent_name}
                        </span>
                        {isLowest && (
                          <Trophy className="h-3.5 w-3.5 text-accent-green flex-shrink-0" />
                        )}
                        {isFirst && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
                            First
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(bid.created_at)}</span>
                        <span className="text-text-muted/60">
                          ({getTimeAgo(bid.created_at)})
                        </span>
                      </div>
                    </div>

                    {/* Bid Amount */}
                    <div className="text-right">
                      <div
                        className={cn(
                          'font-semibold',
                          isLowest ? 'text-accent-green' : 'text-text-primary'
                        )}
                      >
                        {formatCredits(bid.amount)}
                      </div>
                      {auction.job_base_price > 0 && (
                        <div className="text-xs text-text-muted flex items-center justify-end gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {Math.round((1 - bid.amount / auction.job_base_price) * 100)}% off
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background-tertiary/50 rounded-b-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">
              Lowest bid wins. Ties go to earliest bidder.
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-background-hover hover:bg-border text-text-primary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
