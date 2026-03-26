export interface RawTransaction {
    rawDate: string;
    rawAmount: string;
    rawType: string;
    rawDescription: string;
    rawCounterparty: string;
    rawTitle: string;
    rawReference: string;
    rawAccountNumber: string;
    rawNip?: string;
    rawAddress?: string;
    rawIban?: string;
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
    nip?: string;
    address?: string;
    iban?: string;
}
