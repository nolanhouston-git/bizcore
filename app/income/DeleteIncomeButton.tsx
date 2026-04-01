"use client";

type Props = {
  id: number;
  deleteIncome: (id: number) => Promise<void>;
};

export default function DeleteIncomeButton({ id, deleteIncome }: Props) {
  async function handleClick() {
    const confirmed = confirm("Are you sure you want to delete this income record?");
    if (!confirmed) return;
    await deleteIncome(id);
  }

  return (
    <button
      onClick={handleClick}
      className="bg-[#2d0a0a] border border-[#f87171]/30 text-[#f87171] rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wider hover:bg-[#f87171]/20 transition-colors"
    >
      Delete
    </button>
  );
}