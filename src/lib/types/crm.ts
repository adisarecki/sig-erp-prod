export interface BankAccountInfo {
    accountNumber: string;
    isDefault: boolean;
    isVerified?: boolean;
}

export interface Contractor {
    id: string;
    name: string;
    nip?: string | null;
    address?: string | null;
    bankAccounts?: BankAccountInfo[];
}

export interface Project {
    id: string;
    name: string;
    contractorId?: string;
    status?: string;
    retentionShortTermRate?: number;
    retentionLongTermRate?: number;
    retentionBase?: 'NET' | 'GROSS';
}
