import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Server, Database } from 'lucide-react';
import { checkServer, checkDatabase } from '../api/health';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/common/Loading';

function StatusRow({ icon: Icon, title, state }) {
  const healthy = state?.ok;
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">
            {healthy
              ? state?.message ?? 'Healthy'
              : `${state?.message ?? 'Unreachable'}${state?.status ? ` (HTTP ${state.status})` : ''}`}
          </p>
          {healthy && state?.data?.latencyMs != null ? (
            <p className="text-xs text-muted-foreground">Round-trip: {state.data.latencyMs} ms</p>
          ) : null}
        </div>
      </div>
      {healthy ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-active-bg px-2.5 py-0.5 text-xs font-medium text-status-active">
          <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-danger-bg px-2.5 py-0.5 text-xs font-medium text-status-danger">
          <XCircle className="h-3.5 w-3.5" /> Down
        </span>
      )}
    </div>
  );
}

export default function SystemStatus() {
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState(null);
  const [database, setDatabase] = useState(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    const [s, d] = await Promise.all([checkServer(), checkDatabase()]);
    setServer(s);
    setDatabase(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System status</h1>
          <p className="text-muted-foreground">Live liveness and readiness checks.</p>
        </div>
        <Button variant="outline" size="sm" onClick={runChecks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && !server ? (
        <Loading label="Running health checks…" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow icon={Server} title="API server (liveness)" state={server} />
            <StatusRow icon={Database} title="Database (readiness)" state={database} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
