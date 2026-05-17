import { useEffect, useRef } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage, FormDescription } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const settingsSchema = z.object({
  dailyTarget: z.coerce.number().min(1).max(100000),
  scheduleTime: z.string(),
  proxyEnabled: z.boolean(),
  retryEnabled: z.boolean(),
  retryMax: z.coerce.number().min(1).max(10),
  isActive: z.boolean(),
  emailDomain: z.string().min(1),
  usernamePrefix: z.string().min(1),
});

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      dailyTarget: 100,
      scheduleTime: "00:00",
      proxyEnabled: false,
      retryEnabled: false,
      retryMax: 3,
      isActive: false,
      emailDomain: "example.com",
      usernamePrefix: "user",
    },
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (settings && !initialized.current) {
      form.reset(settings);
      initialized.current = true;
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettings.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "Settings saved successfully" });
        }
      }
    );
  };

  if (isLoading && !settings) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
        <Card className="border-border">
          <CardContent className="p-6 space-y-8">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-10 w-full max-w-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
      </div>

      <Card className="border-border max-w-3xl">
        <CardHeader className="border-b border-border bg-card/50">
          <CardTitle className="text-sm font-mono tracking-widest text-primary flex items-center">
            <Settings2 className="w-4 h-4 mr-2" /> BOT_SETTINGS
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-md border border-border">
                    <h3 className="font-mono text-sm tracking-wider mb-4 border-b border-border pb-2 text-muted-foreground">GENERATION RULES</h3>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="dailyTarget"
                        render={({ field }) => (
                          <FormItem>
                            <Label className="font-mono text-xs">DAILY TARGET</Label>
                            <FormControl>
                              <Input {...field} type="number" className="font-mono bg-input border-border" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emailDomain"
                        render={({ field }) => (
                          <FormItem>
                            <Label className="font-mono text-xs">EMAIL DOMAIN</Label>
                            <FormControl>
                              <Input {...field} className="font-mono bg-input border-border" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="usernamePrefix"
                        render={({ field }) => (
                          <FormItem>
                            <Label className="font-mono text-xs">USERNAME PREFIX</Label>
                            <FormControl>
                              <Input {...field} className="font-mono bg-input border-border" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-md border border-border">
                    <h3 className="font-mono text-sm tracking-wider mb-4 border-b border-border pb-2 text-muted-foreground">AUTOMATION & NETWORK</h3>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-sm bg-card">
                            <div className="space-y-0.5">
                              <Label className="font-mono text-xs">MASTER SWITCH</Label>
                              <FormDescription className="text-xs">Enable automatic scheduling</FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="data-[state=checked]:bg-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="scheduleTime"
                        render={({ field }) => (
                          <FormItem>
                            <Label className="font-mono text-xs">SCHEDULE TIME (HH:MM)</Label>
                            <FormControl>
                              <Input {...field} type="time" className="font-mono bg-input border-border" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="proxyEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-sm bg-card mt-2">
                            <div className="space-y-0.5">
                              <Label className="font-mono text-xs">USE PROXIES</Label>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="data-[state=checked]:bg-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="retryEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-sm bg-card">
                              <Label className="font-mono text-xs">AUTO RETRY</Label>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-primary"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="retryMax"
                          render={({ field }) => (
                            <FormItem>
                              <Label className="font-mono text-xs">MAX RETRIES</Label>
                              <FormControl>
                                <Input {...field} type="number" className="font-mono bg-input border-border h-11" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button 
                  type="submit" 
                  disabled={updateSettings.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettings.isPending ? 'SAVING...' : 'SAVE CONFIGURATION'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
