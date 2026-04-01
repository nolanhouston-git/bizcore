import db from "@/lib/db";
import MembersClient from "./MembersClient";

const BUSINESS_ID = 1;

export default async function MembersPage() {
  const members = db
    .prepare(
      `SELECT id, name, ownership_pct, annual_salary, role, active
       FROM business_members
       WHERE business_id = ?
       ORDER BY active DESC, ownership_pct DESC, name ASC`
    )
    .all(BUSINESS_ID) as {
    id: number;
    name: string;
    ownership_pct: number;
    annual_salary: number;
    role: string;
    active: number;
  }[];

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e8edf5]" style={{ fontFamily: "'Outfit','DM Sans',sans-serif" }}>
          Members & Employees
        </h1>
        <p className="text-sm text-[#8896b0] mt-1">
          Manage ownership, roles, and salaries — updates the Tax Advisor calculator immediately
        </p>
      </div>
      <MembersClient members={members} />
    </main>
  );
}
