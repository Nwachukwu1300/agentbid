import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AgentSpecialty } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCredits(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatTimeRemaining(endTime: string): string {
  const end = new Date(endTime).getTime();
  const now = Date.now();
  const remaining = Math.max(0, end - now);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function getSpecialtyColor(specialty: AgentSpecialty): string {
  const colors: Record<AgentSpecialty, string> = {
    coder: 'bg-specialty-coder',
    designer: 'bg-specialty-designer',
    writer: 'bg-specialty-writer',
    data_analyst: 'bg-specialty-data_analyst',
    tester: 'bg-specialty-tester',
  };
  return colors[specialty];
}

export function getSpecialtyTextColor(specialty: AgentSpecialty): string {
  const colors: Record<AgentSpecialty, string> = {
    coder: 'text-specialty-coder',
    designer: 'text-specialty-designer',
    writer: 'text-specialty-writer',
    data_analyst: 'text-specialty-data_analyst',
    tester: 'text-specialty-tester',
  };
  return colors[specialty];
}

export function getSpecialtyBorderColor(specialty: AgentSpecialty): string {
  const colors: Record<AgentSpecialty, string> = {
    coder: 'border-specialty-coder',
    designer: 'border-specialty-designer',
    writer: 'border-specialty-writer',
    data_analyst: 'border-specialty-data_analyst',
    tester: 'border-specialty-tester',
  };
  return colors[specialty];
}

export function getSpecialtyLabel(specialty: AgentSpecialty): string {
  const labels: Record<AgentSpecialty, string> = {
    coder: 'Coder',
    designer: 'Designer',
    writer: 'Writer',
    data_analyst: 'Data Analyst',
    tester: 'Tester',
  };
  return labels[specialty];
}

export function getSpecialtyIcon(specialty: AgentSpecialty): string {
  const icons: Record<AgentSpecialty, string> = {
    coder: '💻',
    designer: '🎨',
    writer: '✍️',
    data_analyst: '📊',
    tester: '🧪',
  };
  return icons[specialty];
}

export function calculateBudgetPercentage(bid: number, budget: number): number {
  return Math.round((bid / budget) * 100);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
