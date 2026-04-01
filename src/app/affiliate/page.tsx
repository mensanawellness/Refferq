'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MousePointerClick,
  Target,
  Users,
  Copy,
  Check,
  Link,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  TrendingUp,
  ArrowRight,
  Banknote,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AffiliateStats {
  totalEarnings: number;
  pendingEarnings: number;
  totalClicks: number;
  totalLeads: number;
  totalConversions: number;
  conversionRate: number;
  referralCode: string;
  currencySymbol: string;
  nextMaturesAt: string | null;
  bdConversionsCount: number;
  tierTwoEarnings: number;
  recruitsCount: number;
}

interface Referral {
  id: string;
  leadName: string;
  leadEmail: string;
  company?: string;
  estimatedValue: number;
  status: string;
  createdAt: string;
}

interface Recruit {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  conversionCount: number;
  tierTwoEarned: number;
}

export default function AffiliateDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState<'ambassador' | 'bd' | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      loadDashboardData();
    }
  }, [authLoading, user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/affiliate/profile');
      const data = await response.json();

      if (data.success) {
        const commissions = data.commissions || [];
        const tierTwoEarnings = commissions
          .filter((c: any) => c.tier === 'TIER_TWO' && (c.status === 'PAID' || c.status === 'APPROVED'))
          .reduce((sum: number, c: any) => sum + c.amountCents, 0);

        setStats({
          totalEarnings: data.affiliate?.balanceCents || 0,
          pendingEarnings: data.stats?.pendingEarnings || 0,
          totalClicks: data.stats?.totalClicks || 0,
          totalLeads: data.referrals?.length || 0,
          totalConversions: data.stats?.totalConversions || 0,
          conversionRate: data.stats?.conversionRate || 0,
          referralCode: data.affiliate?.referralCode || '',
          currencySymbol: data.currencySymbol || '$',
          nextMaturesAt: data.stats?.nextMaturesAt || null,
          bdConversionsCount: data.stats?.bdConversionsCount ?? data.bdConversions?.length ?? 0,
          tierTwoEarnings,
          recruitsCount: data.recruits?.length || 0,
        });
        setReferrals(data.referrals || []);
        setRecruits(data.recruits || []);
        setCurrencySymbol(data.currencySymbol || '$');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      const response = await fetch('/api/affiliate/generate-code', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        window.location.reload();
      } else {
        showNotification('error', 'Failed to generate code: ' + data.error);
      }
    } catch (_e) {
      showNotification('error', 'Failed to generate code. Please try again.');
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const copyToClipboard = (text: string, type: 'ambassador' | 'bd') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      APPROVED: { variant: 'default', icon: CheckCircle2 },
      COMPLETED: { variant: 'default', icon: CheckCircle2 },
      PAID: { variant: 'default', icon: CheckCircle2 },
      PENDING: { variant: 'secondary', icon: Clock },
      PROCESSING: { variant: 'secondary', icon: Loader2 },
      REJECTED: { variant: 'destructive', icon: Ban },
      FAILED: { variant: 'destructive', icon: AlertCircle },
    };
    const { variant, icon: Icon } = map[status] || { variant: 'outline' as const, icon: Clock };
    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  const ambassadorLink = `https://refferq-chi.vercel.app/register?ref=${stats?.referralCode || ''}`;
  const bdLink = `https://thesoranetwork.com?ref=${stats?.referralCode || ''}`;

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Available Balance',
            value: formatCurrency(stats?.totalEarnings || 0),
            icon: Banknote,
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            description: 'Ready for payout'
          },
          {
            label: 'Pending Balance',
            value: formatCurrency(stats?.pendingEarnings || 0),
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            description: stats?.nextMaturesAt
              ? `Next maturity: ${new Date(stats.nextMaturesAt).toLocaleDateString('en-US')}`
              : 'Held for refund period'
          },
          { label: 'Total Clicks', value: stats?.totalClicks || 0, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: 'Business Partners Referred', value: stats?.totalLeads || 0, icon: Target, color: 'text-rose-600', bg: 'bg-rose-500/10' },
          { label: 'Conv. Rate', value: `${stats?.conversionRate?.toFixed(1) || '0.0'}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-500/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            whileHover={{ y: -5 }}
          >
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bg} backdrop-blur-sm`}>
                    {stat.icon === Banknote ? (
                      <span className={`text-lg font-bold ${stat.color}`}>$</span>
                    ) : (
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    {stat.description && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{stat.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* BD & Network Activity */}
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Business Partner Conversions', value: stats?.bdConversionsCount || 0, icon: Target, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: 'Ambassador Recruit Earnings', value: formatCurrency(stats?.tierTwoEarnings || 0), icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-500/10' },
          { label: 'Ambassador Recruits', value: stats?.recruitsCount || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
        ].map((stat, i) => (
          <Card key={i} className="border-0 glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link className="h-4 w-4" />
            Your Referral Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stats?.referralCode ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                <Link className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No referral code found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate your referral code to start earning commissions
              </p>
              <Button className="mt-4" onClick={handleGenerateCode}>
                Generate Referral Code
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Ambassador Recruiting Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={ambassadorLink} className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(ambassadorLink, 'ambassador')}
                  >
                    {copied === 'ambassador' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Business Partner Referral Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={bdLink} className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(bdLink, 'bd')}
                  >
                    {copied === 'bd' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Business Partners</CardTitle>
            <CardDescription>Latest 5 submissions</CardDescription>
          </div>
          {referrals.length > 5 && (
            <Button variant="ghost" size="sm" asChild>
              <a href="/affiliate/referrals" className="gap-1">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {referrals.length === 0 ? (
            <EmptyState icon={Users} message="No submissions yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.slice(0, 5).map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-medium">{ref.leadName}</TableCell>
                    <TableCell className="text-muted-foreground">{ref.leadEmail}</TableCell>
                    <TableCell>{getStatusBadge(ref.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(ref.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recruited Ambassadors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recruited Ambassadors</CardTitle>
          <CardDescription>Ambassadors you have recruited and their performance</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recruits.length === 0 ? (
            <EmptyState icon={Users} message="No recruited ambassadors yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Tier-Two Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recruits.map((recruit) => (
                  <TableRow key={recruit.id}>
                    <TableCell className="font-medium">{recruit.name}</TableCell>
                    <TableCell className="text-muted-foreground">{recruit.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(recruit.createdAt)}</TableCell>
                    <TableCell className="text-right">{recruit.conversionCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(recruit.tierTwoEarned)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/referrals'}>
          <CardContent className="p-5 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium">Manage Referrals</p>
              <p className="text-xs text-muted-foreground">View all your submissions</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/reports'}>
          <CardContent className="p-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">View Reports</p>
              <p className="text-xs text-muted-foreground">Analyze your performance</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/resources'}>
          <CardContent className="p-5 flex items-center gap-3">
            <Target className="h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium">Resources</p>
              <p className="text-xs text-muted-foreground">Marketing materials</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-7 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
