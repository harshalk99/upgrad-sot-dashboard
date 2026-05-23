// Sidebar navigation. SPEC.md §13 — exact list of links and their role visibility.
import {
  LayoutDashboard,
  Activity,
  PieChart,
  Flame,
  Clock,
  FileText,
  Heart,
  Phone,
  ShieldCheck,
  ArrowLeftRight,
  Megaphone,
  Zap,
  Settings,
  TrendingUp,
  Users,
  GitBranch,
  Trophy,
  Layers,
  UserCog,
  MessageSquare,
  Flag,
  type LucideIcon
} from 'lucide-react';
import type { UserRole } from '@/lib/auth/userRole';

export type NavItem = {
  module_key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  group: 'business' | 'operations' | 'strategic';
};

export const NAV_ITEMS: NavItem[] = [
  // Business (client + admin + super_admin)
  { module_key: 'overview',                label: 'Overview',           href: '/dashboard',                   icon: LayoutDashboard, roles: ['client','admin','super_admin'], group: 'business' },
  { module_key: 'connectivity',            label: 'Connectivity',       href: '/dashboard/connectivity',      icon: Activity,        roles: ['client','admin','super_admin'], group: 'business' },
  { module_key: 'dispositions',            label: 'Dispositions',       href: '/dashboard/dispositions',      icon: PieChart,        roles: ['client','admin','super_admin'], group: 'business' },
  { module_key: 'hot_warm_leads',          label: 'Hot & Warm Leads',   href: '/dashboard/leads',             icon: Flame,           roles: ['client','admin','super_admin'], group: 'business' },
  // Minutes Used removed per UGSOT request 2026-05-23 — client should not see call-duration aggregates.
  { module_key: 'reports',                 label: 'Reports',            href: '/dashboard/reports',           icon: FileText,        roles: ['client','admin','super_admin'], group: 'business' },

  // Operations (admin + super_admin)
  { module_key: 'realtime_health',         label: 'Real-time Health',   href: '/admin',                       icon: Heart,           roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'call_logs',               label: 'Call Logs',          href: '/admin/call-logs',             icon: Phone,           roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'quality_qa',              label: 'Quality & QA',       href: '/admin/quality-qa',            icon: ShieldCheck,     roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'ls_integration',          label: 'LS Integration',     href: '/admin/ls-integration',        icon: ArrowLeftRight,  roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'campaign_mgmt',           label: 'Campaigns',          href: '/admin/campaigns',             icon: Megaphone,       roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'workflow_triggers',       label: 'Workflow Triggers',  href: '/admin/workflows',             icon: Zap,             roles: ['admin','super_admin'], group: 'operations' },
  { module_key: 'settings',                label: 'Settings',           href: '/admin/settings',              icon: Settings,        roles: ['admin','super_admin'], group: 'operations' },

  // Strategic (super_admin only)
  { module_key: 'strategic_analytics',     label: 'Strategic Overview', href: '/super',                       icon: TrendingUp,      roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Minutes Analytics',  href: '/super/analytics/minutes',     icon: Clock,           roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Lead Analytics',     href: '/super/analytics/leads',       icon: Users,           roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Conversions',        href: '/super/analytics/conversions', icon: GitBranch,       roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Campaign ROI',       href: '/super/analytics/campaigns',   icon: Trophy,          roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Allocations',        href: '/super/allocations',           icon: Layers,          roles: ['super_admin'], group: 'strategic' },
  { module_key: 'flagged_calls_mgmt',      label: 'Flagged Calls',      href: '/super/flagged-calls',         icon: Flag,            roles: ['super_admin'], group: 'strategic' },
  { module_key: 'ai_chat',                 label: 'AI Chat',            href: '/super/chat',                  icon: MessageSquare,   roles: ['super_admin'], group: 'strategic' },
  { module_key: 'strategic_analytics',     label: 'Users',              href: '/super/users',                 icon: UserCog,         roles: ['super_admin'], group: 'strategic' }
];
