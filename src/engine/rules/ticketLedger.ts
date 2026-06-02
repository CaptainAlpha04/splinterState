export type TicketLedger = {
  tickets: number;
};

export function applySafetyNet(ledger: TicketLedger): TicketLedger {
  if (ledger.tickets <= 0) {
    return { ...ledger, tickets: 500 };
  }
  return ledger;
}
