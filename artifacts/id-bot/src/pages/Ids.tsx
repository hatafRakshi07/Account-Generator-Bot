import { useState } from "react";
import { useListIds, useDeleteId, useRetryId, useExportIds, getListIdsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Download, Search, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Ids() {
  const [status, setStatus] = useState<"all" | "success" | "failed" | "pending">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListIds({ status: status !== "all" ? status : undefined, page, limit: 50 });
  const queryClient = useQueryClient();
  const deleteId = useDeleteId();
  const retryId = useRetryId();
  const { toast } = useToast();

  const handleExport = async (format: "csv" | "txt") => {
    try {
      const exportParams = { format, status: status !== "all" ? status : undefined } as any;
      const res = await fetch(`/api/ids/export?format=${format}${status !== 'all' ? `&status=${status}` : ''}`);
      if (!res.ok) throw new Error("Export failed");
      const result = await res.json();
      
      const blob = new Blob([result.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${new Date().toISOString()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Export complete", description: `Exported ${result.count} records as ${format.toUpperCase()}` });
    } catch (e) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleDelete = (id: number) => {
    deleteId.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIdsQueryKey() });
      }
    });
  };

  const handleRetry = (id: number) => {
    retryId.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIdsQueryKey() });
        toast({ title: "Retry initiated" });
      }
    });
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Generated IDs</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("txt")} className="font-mono text-xs">
            <Download className="w-4 h-4 mr-2" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="font-mono text-xs">
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="p-4 border-b border-border bg-card/50 flex flex-row items-center gap-4 space-y-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter table (client-side)..."
              className="pl-8 bg-input border-border font-mono text-sm h-9"
            />
          </div>
          <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-9 font-mono text-sm border-border bg-input">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL_STATUS</SelectItem>
              <SelectItem value="success">SUCCESS</SelectItem>
              <SelectItem value="failed">FAILED</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[100px] font-mono">ID</TableHead>
                <TableHead className="font-mono">Credentials</TableHead>
                <TableHead className="font-mono">Status</TableHead>
                <TableHead className="font-mono">Created At</TableHead>
                <TableHead className="text-right font-mono">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono text-sm">
                    No IDs found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((item) => (
                  <TableRow key={item.id} className="border-border font-mono text-sm">
                    <TableCell className="text-muted-foreground">#{item.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.email}</div>
                      <div className="text-xs text-muted-foreground">{item.username}:{item.password}</div>
                      {item.errorMessage && <div className="text-xs text-destructive mt-1 truncate max-w-xs">{item.errorMessage}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={item.status} />
                        <span className="uppercase text-xs tracking-wider">{item.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {item.status === 'failed' && (
                          <Button variant="ghost" size="icon" onClick={() => handleRetry(item.id)} title="Retry" className="h-8 w-8">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} title="Delete" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data && data.total > data.limit && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                Showing {(data.page - 1) * data.limit + 1} to Math.min(data.page * data.limit, data.total) of {data.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="font-mono text-xs">PREV</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total} className="font-mono text-xs">NEXT</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
