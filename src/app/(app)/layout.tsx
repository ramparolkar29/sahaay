import { currentContext } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentContext();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
