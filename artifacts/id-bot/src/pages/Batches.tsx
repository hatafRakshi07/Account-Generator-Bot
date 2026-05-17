import { useListBatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

export default function Batches() {
  const { data: batches, isLoading } = useListBatches();

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'running': return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Generation Batches</h2>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[100px] font-mono">ID</TableHead>
                <TableHead className="font-mono">Name</TableHead>
                <TableHead className="font-mono text-right">Target</TableHead>
                <TableHead className="font-mono text-right">Success / Fail</TableHead>
                <TableHead className="font-mono">Progress</TableHead>
                <TableHead className="font-mono">Status</TableHead>
                <TableHead className="font-mono">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : batches?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-mono text-sm">
                    No batches found.
                  </TableCell>
                </TableRow>
              ) : (
                batches?.map((batch) => (
                  <TableRow key={batch.id} className="border-border font-mono text-sm">
                    <TableCell className="text-muted-foreground">#{batch.id}</TableCell>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell className="text-right">{batch.targetCount}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-primary">{batch.successCount}</span> / <span className="text-destructive">{batch.failCount}</span>
                    </TableCell>
                    <TableCell className="w-1/4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${batch.status === 'failed' ? 'bg-destructive' : 'bg-primary'} transition-all duration-500`} 
                            style={{ width: `${batch.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{batch.progress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={batch.status} />
                        <span className="uppercase text-xs tracking-wider">{batch.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{new Date(batch.createdAt).toLocaleString()}</span>
                        {batch.completedAt && (
                          <span className="text-xs text-primary">Done: {new Date(batch.completedAt).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
