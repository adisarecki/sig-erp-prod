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

export interface Vehicle {
    id: string;
    make: string;
    model: string;
    plates: string;
    vin?: string | null;
    status?: string;
    assignedProjectId?: string | null;
}
