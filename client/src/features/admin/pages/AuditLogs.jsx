import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loading } from '@/components/common/Loading';
import { ShieldAlert, Terminal, Eye, FileSpreadsheet, Lock } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    // Simulate fetching audit trail logs from immutable database
    setTimeout(() => {
      setLogs([
        {
          id: 'log_9a8b7c6d5e',
          timestamp: '2026-07-18T10:14:00.000Z',
          actionType: 'DEPOSIT_OVERRIDE',
          actor: 'Ada Admin (00000000-0000-4000-8000-000000000001)',
          targetEntity: 'Order RO-2026-E',
          overrideRationale: 'Customer returned unit with slight scratches on handle, waived Rs 500 penalty due to corporate client status.',
          oldValue: { depositTotal: '3000.00', lateFeesAccrued: '1500.00', refundReleased: '1500.00' },
          newValue: { depositTotal: '3000.00', lateFeesAccrued: '1000.00', refundReleased: '2000.00' },
        },
        {
          id: 'log_2c3d4e5f6g',
          timestamp: '2026-07-18T09:30:00.000Z',
          actionType: 'WALK_IN_CHECKOUT',
          actor: 'Ada Admin (00000000-0000-4000-8000-000000000001)',
          targetEntity: 'Order RO-2026-F',
          overrideRationale: 'Offline checkout override - manual swipe validation.',
          oldValue: { status: 'QUOTATION' },
          newValue: { status: 'CONFIRMED' },
        },
        {
          id: 'log_7b8c9d0e1f',
          timestamp: '2026-07-17T16:22:00.000Z',
          actionType: 'PRICELIST_OVERRIDE',
          actor: 'Ada Admin (00000000-0000-4000-8000-000000000001)',
          targetEntity: 'Product Category: DSLR Camera Kit',
          overrideRationale: 'Peak seasonal surcharge override applied for summer peak dates.',
          oldValue: { baseDailyRate: '1200.00' },
          newValue: { baseDailyRate: '1500.00' },
        }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return <Loading label="Retrieving immutable audit records..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground text-xs">Immutable system override history and security logging records.</p>
        </div>
        <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/10 gap-1 font-bold uppercase tracking-wider text-[10px]">
          <Lock className="size-3" /> Immutable Logs
        </Badge>
      </div>

      {/* Sticky High Security Alert Banner */}
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-500">
        <ShieldAlert className="size-4" />
        <AlertTitle className="font-heading font-extrabold uppercase text-xs tracking-wider">
          IMMUTABLE AUDIT LOG - SYSTEM SECURITY ROLE ENFORCED
        </AlertTitle>
        <AlertDescription className="text-xs">
          ALL AD-HOC OVERRIDES, PRICE ALTERATIONS, AND MANUAL CHECKOUT DETAILS ARE PERMANENTLY RECORDED. 
          DATABASE-LEVEL TRIGGERS PREVENT UPDATES OR DELETIONS ON THESE RECORDS.
        </AlertDescription>
      </Alert>

      {/* Logs Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">System Access Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Action Type</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">Override Rationale</th>
                  <th className="p-4 text-right">View Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="p-4 text-xs font-mono">
                      {format(new Date(log.timestamp), 'PP p')}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/5 uppercase text-[9px]">
                        {log.actionType}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs max-w-[200px] truncate" title={log.actor}>
                      {log.actor}
                    </td>
                    <td className="p-4 font-semibold text-xs">{log.targetEntity}</td>
                    <td className="p-4 text-xs text-muted-foreground max-w-[280px] truncate" title={log.overrideRationale}>
                      {log.overrideRationale}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {selectedLog && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <Terminal className="size-5 text-red-500" />
                <span>Audit Detail: {selectedLog.id}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Timestamp: {format(new Date(selectedLog.timestamp), 'PPP p')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Authorized Actor</span>
                <p className="font-semibold text-foreground bg-muted p-2 rounded">{selectedLog.actor}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Override Rationale text</span>
                <p className="italic text-muted-foreground bg-muted p-2.5 rounded border border-border">
                  "{selectedLog.overrideRationale}"
                </p>
              </div>

              {/* Changes Diff Side by Side */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Changes JSON State Diff</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-500/5 border border-red-500/20 p-3 rounded font-mono">
                    <span className="text-[9px] uppercase font-bold text-red-600 block mb-1">Pre-Override State (-)</span>
                    <pre className="overflow-x-auto text-[10px]">{JSON.stringify(selectedLog.oldValue, null, 2)}</pre>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded font-mono">
                    <span className="text-[9px] uppercase font-bold text-emerald-600 block mb-1">Post-Override State (+)</span>
                    <pre className="overflow-x-auto text-[10px]">{JSON.stringify(selectedLog.newValue, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
