import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "@/components/dashboard/Sidebar";
import type { Company } from "@/types/database";

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companyData } = await supabase
    .from("companies")
    .select("company_name, queries_used, monthly_quota")
    .eq("user_id", user.id)
    .maybeSingle();

  const company = companyData as Pick<Company, "company_name" | "queries_used" | "monthly_quota"> | null;
  if (!company) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        companyName={company.company_name}
        queriesUsed={company.queries_used}
        monthlyQuota={company.monthly_quota}
      />
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
