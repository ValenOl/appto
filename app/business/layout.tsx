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
    .select("company_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const company = companyData as Pick<Company, "company_name"> | null;
  if (!company) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar companyName={company.company_name} />
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
