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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  Search,
  Filter,
  Download,
} from 'lucide-react';

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

export default function ReferralsPage() {
  const { user, loading: authLoading } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [refRes, profileRes] = await Promise.all([
        fetch('/api/affiliate/referrals'),
        fetch('/api/affiliate/profile'),
      ]);
      const refData = await refRes.json();
      const profileData = await profileRes.json();
      if (refData.success) setReferrals(refData.referrals || []);
      if (profileData.success) setRecruits(profileData.recruits || []);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      APPROVED: { variant: 'default', icon: CheckCircle2 },
      PENDING: { variant: 'secondary', icon: Clock },
      REJECTED: { variant: 'destructive', icon: Ban },
    };
    const { variant, icon: Icon } = map[status] || { variant: 'outline' as const, icon: Clock };
    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const filteredReferrals = referrals.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.leadEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === 'PENDING').length,
    approved: referrals.filter((r) => r.status === 'APPROVED').length,
    rejected: referrals.filter((r) => r.status === 'REJECTED').length,
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Status', 'Date'];
    const rows = filteredReferrals.map((r) => [
      r.leadName,
      r.leadEmail,
      r.company || '',
      r.status,
      formatDate(r.createdAt),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground">Track your business partner referrals and ambassador recruits</p>
      </div>

      {/* Business Partner Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Business Partners Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Business Partner Referrals</h2>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {filteredReferrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No business partner referrals found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {referrals.length === 0 ? 'Business partners you refer will appear here' : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Partner Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium">{ref.leadName}</TableCell>
                      <TableCell className="text-muted-foreground">{ref.leadEmail}</TableCell>
                      <TableCell className="text-muted-foreground">{ref.company || '\u2014'}</TableCell>
                      <TableCell>{getStatusBadge(ref.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(ref.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ambassador Recruits Section */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Ambassador Recruits</h2>
        <p className="text-sm text-muted-foreground mb-4">Ambassadors you have recruited via your ambassador recruiting link</p>

        <Card>
          <CardContent className="p-0">
            {recruits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No ambassador recruits yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ambassadors you recruit will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date Joined</TableHead>
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
      </div>
    </div>
  );
}
