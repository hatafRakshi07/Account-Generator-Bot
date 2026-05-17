import { useListProxies, useAddProxy, useDeleteProxy, useToggleProxy, getListProxiesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Network, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const proxySchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
});

export default function Proxies() {
  const { data: proxies, isLoading } = useListProxies();
  const queryClient = useQueryClient();
  const addProxy = useAddProxy();
  const deleteProxy = useDeleteProxy();
  const toggleProxy = useToggleProxy();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof proxySchema>>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      host: "",
      port: 8080,
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof proxySchema>) => {
    addProxy.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
          form.reset();
          toast({ title: "Proxy added successfully" });
        }
      }
    );
  };

  const handleToggle = (id: number, isActive: boolean) => {
    toggleProxy.mutate(
      { id, data: { isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteProxy.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Proxy Management</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr]">
        <Card className="border-primary/20 bg-card h-fit">
          <CardHeader className="border-b border-border bg-card/50">
            <CardTitle className="text-sm font-mono tracking-widest text-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" /> ADD_PROXY
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="font-mono text-xs text-muted-foreground">HOST / IP</Label>
                      <FormControl>
                        <Input {...field} className="font-mono bg-input border-border" placeholder="e.g. 192.168.1.1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="font-mono text-xs text-muted-foreground">PORT</Label>
                      <FormControl>
                        <Input {...field} type="number" className="font-mono bg-input border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="font-mono text-xs text-muted-foreground">USERNAME (OPTIONAL)</Label>
                      <FormControl>
                        <Input {...field} className="font-mono bg-input border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="font-mono text-xs text-muted-foreground">PASSWORD (OPTIONAL)</Label>
                      <FormControl>
                        <Input {...field} type="password" className="font-mono bg-input border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={addProxy.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider mt-4"
                >
                  {addProxy.isPending ? 'ADDING...' : 'ADD PROXY'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="border-b border-border bg-card/50">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground flex items-center">
              <Network className="w-4 h-4 mr-2" /> PROXY_POOL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono">Address</TableHead>
                  <TableHead className="font-mono">Auth</TableHead>
                  <TableHead className="font-mono">Status</TableHead>
                  <TableHead className="font-mono">Last Used</TableHead>
                  <TableHead className="font-mono text-right">Active</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : proxies?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono text-sm">
                      No proxies configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  proxies?.map((proxy) => (
                    <TableRow key={proxy.id} className="border-border font-mono text-sm">
                      <TableCell className="font-medium">{proxy.host}:{proxy.port}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {proxy.username ? 'Yes' : 'No'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {proxy.status === 'active' ? (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          ) : proxy.status === 'failed' ? (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                          )}
                          <span className="uppercase text-xs tracking-wider">{proxy.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {proxy.lastUsed ? new Date(proxy.lastUsed).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Switch 
                            checked={proxy.isActive} 
                            onCheckedChange={(c) => handleToggle(proxy.id, c)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(proxy.id)} 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
