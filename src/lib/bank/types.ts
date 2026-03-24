export interface RawTransaction {
    rawDate: string;
    rawAmount: string;
    rawType: string;
    rawDescription: string;
    rawCounterparty: string;
    rawTitle: string;
    rawReference: string;
    rawAccountNumber: string;
}

export interface NormalizedTx {
    date: Date;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    counterparty: string;
    title: string;
    description: string;
    reference: string;
    accountNumber: string | null;
}
