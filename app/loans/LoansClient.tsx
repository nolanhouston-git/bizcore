"use client";

import { useState } from "react";
import LinkFromLoanDialog from "./LinkFromLoanDialog";

type LoanOption = {
  id: number;
  lenderDisplayName: string;
  borrowerDisplayName: string;
  outstandingBalance: number;
  interest_rate: number;
  term_months: number | null;
};

type Props = {
  loans: LoanOption[];
  hasUnlinked: boolean;
};

export default function LoansClient({ loans, hasUnlinked }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      {dialogOpen && (
        <LinkFromLoanDialog
          loans={loans}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => setDialogOpen(false)}
        />
      )}
      <div title={!hasUnlinked ? "No unlinked Loan Transactions in Expenses or Income" : undefined}>
        <button
          onClick={() => setDialogOpen(true)}
          disabled={!hasUnlinked}
          className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 disabled:hover:border-gray-700"
        >
          Link Plaid Transaction
        </button>
      </div>
    </>
  );
}