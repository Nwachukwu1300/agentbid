import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { PlayerToken } from '@/components/ui';
import { cn, formatTimeAgo, getSpecialtyLabel } from '@/lib/utils';
import type { Round } from './round';

const STEPS = ['The job', 'Sealed bids', 'The reveal', 'Second price', 'The client', 'Scored'] as const;
const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';
// Board geometry (rem): the job card sits above the row of player mats
const JOB_H = 6;
const GAP = 0.75;

/** A real round stepped through like a rulebook example: the page's signature interaction. */
export function WorkedExample({ round }: { round: Round }) {
  const [step, setStep] = useState(0);
  const last = STEPS.length - 1;
  const revealed = step >= 2;
  const n = round.bids.length;
  const winnerIndex = round.bids.findIndex((b) => b.won);
  const winner = round.bids[winnerIndex];
  // The coin starts on the mat whose bid set the price (the winner's own when nobody bid more);
  // the second-price step moves it to the winner
  const priceSetter = round.bids.findIndex((b, i) => i > winnerIndex && b.bid === round.pricePaid);
  const coinIndex = step >= 3 || priceSetter === -1 ? winnerIndex : priceSetter;
  const colLeft = (i: number) => `calc(${i} * ((100% - ${(n - 1) * GAP}rem) / ${n} + ${GAP}rem))`;
  const colCenter = (i: number) => `calc(${colLeft(i)} + (100% - ${(n - 1) * GAP}rem) / ${n} / 2)`;
  const scored = step === last;

  const go = (s: number) => setStep(Math.max(0, Math.min(last, s)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(step + 1);
    if (e.key === 'ArrowLeft') go(step - 1);
  };

  const narration = [
    <>A <strong>{getSpecialtyLabel(round.specialty)}</strong> job goes on the board with a budget of <strong>{round.budget} credits</strong>. Only {getSpecialtyLabel(round.specialty).toLowerCase()} agents may bid.</>,
    <>Each agent bids once, in secret, following its owner's written strategy. Nobody sees a rival's bid. Each agent knows only its own cost for the job.</>,
    <>The bids are revealed. The lowest bid wins: <strong>{winner.name}</strong> at <strong>{winner.bid}</strong>.</>,
    round.pricePaid > winner.bid
      ? <>The winner is paid the runner-up's bid, not its own: <strong>{round.pricePaid} credits</strong>, against a work cost of {winner.cost}. Bidding your true cost is safe; you can't raise your own pay by bidding higher.</>
      : <>Nobody bid above the winner, so it is paid its own bid: <strong>{round.pricePaid} credits</strong>, against a work cost of {winner.cost}.</>,
    round.call
      ? <>This round, the client wanted to haggle. It has a secret limit and a personality; the agent follows its owner's negotiation style. {round.call.outcome}</>
      : <>No call this round: the job went straight to work. About 3 in 10 wins go to a negotiation with the client first.</>,
    <><strong>{winner.name}</strong> takes the job. Every result is explained from the data, for every agent in the round.</>,
  ];

  return (
    <section aria-labelledby="example-title" className="card p-0 overflow-hidden" onKeyDown={onKey}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink/80 bg-background-tertiary px-5 py-4 sm:px-7">
        <h2 id="example-title" className="text-xl font-bold sm:text-2xl">
          Example: <span className="font-semibold">{round.jobTitle}</span>
        </h2>
        <p className="text-sm text-text-muted">
          {round.id
            ? <>A real round from the live arena{round.closedAt ? `, ${formatTimeAgo(round.closedAt)}` : ''}</>
            : <strong className="text-accent-red">Sample round, not live data. A real one appears once the arena plays.</strong>}
        </p>
      </header>

      {/* The round track: one row of spaces, the job's token on the current one */}
      <nav aria-label="Steps of the round" className="overflow-x-auto border-b border-ink/20 px-5 py-4 sm:px-7">
        <ol className="flex min-w-max items-center">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center">
              {i > 0 && <span aria-hidden className={cn('h-0.5 w-6 sm:w-10', i <= step ? 'bg-ink' : 'bg-ink/20')} />}
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  i === step ? 'border-ink bg-background-card text-text-primary shadow-piece' : i < step ? 'border-ink/60 bg-background-tertiary text-text-secondary' : 'border-ink/20 bg-background-card text-text-muted hover:border-ink/50'
                )}
              >
                {i === step
                  ? <PlayerToken specialty={round.specialty} size="sm" />
                  : <span className="w-4 text-center tabular-nums">{i + 1}</span>}
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-8 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {/* The board: the job card above one player mat per bidder */}
          <div className="-mx-1 overflow-x-auto px-1 pb-6">
            <div className="relative" style={{ minWidth: `${n * 7.5 + (n - 1) * GAP}rem` }}>
              <div
                className={cn(
                  'flex items-center justify-between gap-4 rounded-lg border-2 border-ink bg-background-card px-4 transition-shadow duration-500',
                  step === 0 ? 'shadow-lifted ring-2 ring-gold' : 'shadow-piece'
                )}
                style={{ height: `${JOB_H}rem` }}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                    <PlayerToken specialty={round.specialty} size="xs" />
                    {getSpecialtyLabel(round.specialty)} job
                  </p>
                  <p className="mt-1 line-clamp-2 font-bold leading-snug">{round.jobTitle}</p>
                  <p className="text-sm text-text-secondary">Budget {round.budget}</p>
                </div>
                <p className={cn('flex-shrink-0 pr-9 text-right text-xs font-semibold transition-opacity duration-500', scored ? 'opacity-100' : 'opacity-0')}>
                  Taken by<span className="block text-sm text-text-primary">{winner.name}</span>
                </p>
              </div>

              <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: `${GAP}rem` }}>
                {round.bids.map((b, i) => {
                  const isWinner = revealed && b.won;
                  return (
                    <div
                      key={b.name}
                      className={cn(
                        'relative rounded-lg border bg-background-card p-3 transition-[box-shadow,border-color] duration-500',
                        isWinner ? 'border-ink shadow-lifted ring-2 ring-gold' : 'border-ink/30'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* The winner's token leaves its mat for the job card at the last step */}
                        <PlayerToken specialty={b.specialty} size="sm" className={cn(b.won && 'invisible')} />
                        <span className="truncate text-sm font-semibold">{b.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">Cost {b.cost}</p>
                      <div
                        className={cn(
                          'mt-3 flex h-14 items-center justify-center rounded-md border text-2xl font-bold transition-colors duration-500',
                          step === 0 && 'border-dashed border-ink/25 text-xs font-semibold text-text-muted',
                          step === 1 && 'border-ink/40 bg-[repeating-linear-gradient(135deg,#DCE4DA_0_6px,#F1F4F0_6px_12px)] text-text-muted',
                          revealed && (isWinner ? 'border-ink bg-gold text-gold-ink' : 'border-ink/30 bg-background-tertiary text-text-secondary')
                        )}
                        aria-label={step === 0 ? 'Has not bid yet' : step === 1 ? 'Sealed bid' : `Bid ${b.bid}`}
                      >
                        {step === 0 ? 'Not bid yet' : step === 1 ? <Lock className="h-5 w-5" aria-hidden /> : b.bid}
                      </div>
                      {revealed && <p className={cn('mt-2 text-xs font-semibold', isWinner ? 'text-text-primary' : 'text-text-muted')}>{isWinner ? 'Lowest bid: wins' : i < winnerIndex ? 'Couldn’t take the job' : 'Higher bid'}</p>}
                    </div>
                  );
                })}
              </div>

              {/* The winner's token: on its mat until it travels onto the job card */}
              <span
                aria-hidden
                className={cn('pointer-events-none absolute transition-[left,top] duration-700', EASE)}
                style={scored
                  ? { left: 'calc(100% - 2.25rem)', top: `calc(${JOB_H / 2}rem - 0.5rem)` }
                  : { left: `calc(${colLeft(winnerIndex)} + 0.75rem)`, top: `calc(${JOB_H}rem + 0.75rem + 0.75rem + 2px)` }}
              >
                <PlayerToken specialty={winner.specialty} size="sm" />
              </span>

              {/* The price coin: what the winner is paid */}
              {step >= 2 && (
                <div
                  aria-hidden
                  className={cn('pointer-events-none absolute -bottom-4 flex h-9 min-w-9 -translate-x-1/2 items-center justify-center rounded-full border-2 border-ink bg-gold px-2 text-xs font-bold text-gold-ink shadow-piece transition-[left] duration-700', EASE)}
                  style={{ left: colCenter(coinIndex) }}
                >
                  {round.pricePaid}
                </div>
              )}
            </div>
          </div>

          {step >= 4 && round.call && (
            <div className="mt-6 space-y-2 rounded-lg border border-ink/30 bg-background-tertiary p-4">
              {round.call.lines.map((l, i) => (
                <p key={i} className="text-sm">
                  <span className="font-semibold">{l.speaker === 'client' ? 'Client' : winner.name}</span>
                  <span className="text-text-muted"> · {l.move}</span>
                  <span className="mt-0.5 block text-text-secondary">{l.text}</span>
                </p>
              ))}
              <p className="pt-1 text-sm font-semibold">{round.call.outcome}</p>
            </div>
          )}

          {scored && (
            <ul className="mt-6 space-y-2">
              {round.bids.map((b) => (
                <li key={b.name} className="flex gap-3 text-sm">
                  <PlayerToken specialty={b.specialty} size="sm" className="mt-0.5" />
                  <span><strong>{b.name}.</strong> <span className="text-text-secondary">{b.explanation}</span></span>
                </li>
              ))}
              {round.call && <li className="pl-7 text-sm text-text-secondary">{round.call.reveal}</li>}
            </ul>
          )}
        </div>

        {/* The rulebook column: what this step means */}
        <div className="flex flex-col">
          <p className="min-h-[7.5rem] text-base leading-relaxed text-text-secondary" aria-live="polite">{narration[step]}</p>
          <div className="mt-auto flex items-center gap-2 pt-4">
            <button type="button" className="btn-secondary px-3" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => go(step + 1)} disabled={scored}>
              {scored ? 'Round complete' : `Next: ${STEPS[step + 1]}`}
              {!scored && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </div>
          {round.id && scored && (
            <Link to={`/auctions/${round.id}`} className="mt-3 text-sm font-semibold text-accent-purple underline">
              See the full round, with every decision
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
