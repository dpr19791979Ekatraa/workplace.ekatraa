import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetCurrentUser, useUpdateCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  birthday: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const updateUser = useUpdateCurrentUser();

  const { data: currentUser, isLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: (currentUser as any)?.firstName ?? "",
      lastName: (currentUser as any)?.lastName ?? "",
      jobTitle: (currentUser as any)?.jobTitle ?? "",
      phone: (currentUser as any)?.phone ?? "",
      avatarUrl: (currentUser as any)?.avatarUrl ?? "",
      linkedinUrl: (currentUser as any)?.linkedinUrl ?? "",
      bio: (currentUser as any)?.bio ?? "",
      birthday: (currentUser as any)?.birthday ?? "",
    },
  });

  const onSubmit = (data: ProfileForm) => {
    const payload: any = { ...data };
    payload.birthday = payload.birthday ? payload.birthday : null;
    updateUser.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
    });
  };

  const userInitials = currentUser
    ? `${(currentUser as any).firstName?.[0] ?? ""}${(currentUser as any).lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  return (
    <Layout title="Settings">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={(currentUser as any)?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground" data-testid="settings-user-name">
                    {(currentUser as any)?.firstName} {(currentUser as any)?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{(currentUser as any)?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {(currentUser as any)?.role?.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" data-testid="input-first-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" data-testid="input-last-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Software Engineer" data-testid="input-job-title" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. +1 555 000 0000" data-testid="input-phone" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="birthday" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birthday</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-birthday" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="avatarUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." data-testid="input-avatar-url" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="linkedinUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/your-handle" data-testid="input-linkedin-url" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A short bio about yourself..." rows={4} data-testid="input-bio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateUser.isPending} data-testid="save-profile-button">
                    {updateUser.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {(["light", "dark", "system"] as const).map((t) => {
                const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
                return (
                  <Button
                    key={t}
                    variant={theme === t ? "default" : "outline"}
                    className="flex-1 capitalize"
                    onClick={() => setTheme(t)}
                    data-testid={`theme-${t}`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {t}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
