import { HeartPulse, Shield, Sword, Wand2, Zap, type LucideIcon } from 'lucide-react';
import type { Role } from '@/lib/analytics/roles';
import { cn } from '@/lib/utils';

export const ROLE_ICON: Record<Role, LucideIcon> = {
  carry: Sword,
  mid: Zap,
  offlane: Shield,
  soft: Wand2,
  hard: HeartPulse,
};

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const Icon = ROLE_ICON[role];
  return <Icon className={cn('h-4 w-4', className)} />;
}
