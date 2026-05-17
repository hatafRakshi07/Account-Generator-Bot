import { useGetIdStats, useCreateBatch, useListBatches, getGetIdStatsQueryKey, getListBatchesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Users, Activity, AlertTriangle, CheckCircle, Terminal, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const batchSchema = z.object({
  targetCount: z.coerce.number().min(1).max(10000),
});

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetIdStats();
  const { data: batches, isLoading: batchesLoading } = useListBatches();
  
  const createBatch = useCreateBatch();
  
  const form = useForm<z.infer<typeof batchSchema>>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      targetCount: 100,
    },
  });

  const onSubmit = (values: z.infer<typeof batchSchema>) => {
    createBatch.mutate(
      { data: { targetCount: values.targetCount, name: `Quick Batch - ${new Date().toLocaleTimeString()}` } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetIdStatsQueryKey() });
          form.reset();
        }
      }
    );
  };

  const activeBatches = batches?.filter(b => b.status === 'running' || b.status === 'pending') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Mission Control</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Generated" 
          value={stats?.total} 
          icon={<Users className="w-4 h-4 text-primary" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Today's Target" 
          value={stats?.todayTotal} 
          icon={<Activity className="w-4 h-4 text-blue-400" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Success Rate" 
          value={stats ? `${stats.successRate.toFixed(1)}%` : undefined} 
          icon={<CheckCircle className="w-4 h-4 text-primary" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Failed Count" 
          value={stats?.failedCount} 
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />} 
          loading={statsLoading} 
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-card">
          <CardHeader className="border-b border-border bg-card/50">
            <CardTitle className="flex items-center text-sm font-mono tracking-widest text-primary">
              <Terminal className="w-4 h-4 mr-2" />
              QUICK_START
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetCount"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Target Count</Label>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input 
                            {...field} 
                            type="number" 
                            className="font-mono bg-input border-border" 
                          />
                          <Button 
                            type="submit" 
                            disabled={createBatch.isPending}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {createBatch.isPending ? 'Starting...' : 'Execute'}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="border-b border-border bg-card/50">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground">ACTIVE_TASKS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {batchesLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : activeBatches.length > 0 ? (
              <div className="divide-y divide-border">
                {activeBatches.map(batch => (
                  <div key={batch.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">{batch.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: {batch.targetCount} | Progress: {batch.progress}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${batch.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-primary animate-pulse">{batch.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground font-mono">
                No active batches running.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string; value?: string | number; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold font-mono">{value ?? '-'}</div>
        )}
      </CardContent>
    </Card>
  );
}
