import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Rozpoczynam seedowanie bazy danych (wersja PL)...')

    // Czyszczenie bazy przed seedowaniem
    await prisma.auditLog.deleteMany()
    await prisma.bankTransactionRaw.deleteMany()
    await prisma.bankAccount.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.transaction.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.projectStage.deleteMany()
    await prisma.project.deleteMany()
    await prisma.object.deleteMany()
    await prisma.contact.deleteMany()
    await prisma.contractor.deleteMany()
    await prisma.user.deleteMany()
    await prisma.role.deleteMany()
    await prisma.tenant.deleteMany()

    console.log('Baza danych oczyszczona.')

    // 1. Dzierżawa (Tenant) - Reprezentuje naszą Firmę Inżynieryjną
    const tenant = await prisma.tenant.create({
        data: {
            name: 'Super Inżynieria Sp. z o.o.',
            nip: '1234567890'
        }
    })

    // 2. Użytkownicy i Role (RBAC)
    const roleOwner = await prisma.role.create({
        data: { name: 'OWNER', permissions: { all: true } }
    })

    const adminUser = await prisma.user.create({
        data: {
            tenantId: tenant.id,
            email: 'admin@superinzynieria.pl',
            passwordHash: 'hashed_password_placeholder', // w realnym świecie hashowane
            firstName: 'Adam',
            lastName: 'Dyrektor',
            roleId: roleOwner.id
        }
    })

    // 3. Konta Bankowe
    const darmoweKonto = await prisma.bankAccount.create({
        data: {
            tenantId: tenant.id,
            bankName: 'mBank',
            iban: 'PL12345678901234567890123456',
            currency: 'PLN'
        }
    })

    // 4. Kontrahenci
    const contractor1 = await prisma.contractor.create({
        data: {
            tenantId: tenant.id,
            nip: '5261005040',
            name: 'Budimex S.A. - Generalny Wykonawca',
            address: 'ul. Siedmiogrodzka 9, 01-204 Warszawa',
            creditRating: 95,
            contacts: {
                create: [
                    { firstName: 'Jan', lastName: 'Kowalski', position: 'Kierownik Budowy', email: 'jan.kowalski@budimex.pl' }
                ]
            }
        }
    })

    const contractor2 = await prisma.contractor.create({
        data: {
            tenantId: tenant.id,
            nip: '1112223344',
            name: 'Echo Investment S.A. - Deweloper',
            address: 'al. Solidarności 36, 25-323 Kielce',
            creditRating: 90,
        }
    })

    // 5. Obiekty
    const obj1 = await prisma.object.create({
        data: {
            contractorId: contractor1.id,
            name: 'Biurowiec Skyline - Warszawa',
            address: 'Rondo Daszyńskiego, Warszawa',
            description: 'Zarządzanie automatyką budynkową i instalacjami elektrycznymi.'
        }
    })

    const obj2 = await prisma.object.create({
        data: {
            contractorId: contractor2.id,
            name: 'Osiedle Zielone Tarasy - Kraków',
            address: 'ul. Długa, Kraków',
            description: 'Wielki kompleks mieszkaniowy'
        }
    })

    // 6. Projekty Inżynieryjne
    const projectElec = await prisma.project.create({
        data: {
            tenantId: tenant.id,
            contractorId: contractor1.id,
            objectId: obj1.id,
            name: 'Instalacja Elektryczna (Poziom -1 i -2)',
            type: 'Instalacja Elektryczna',
            status: 'IN_PROGRESS',
            budgetEstimated: 150000.00,
            budgetUsed: 84000.00,
        }
    })

    const projectPump = await prisma.project.create({
        data: {
            tenantId: tenant.id,
            contractorId: contractor2.id,
            objectId: obj2.id,
            name: 'Centrala Pompowni Pożarowej CP-01',
            type: 'Automatyka',
            status: 'IN_PROGRESS',
            budgetEstimated: 85000.00,
            budgetUsed: 42000.00,
        }
    })

    // 7. Faktury, Transakcje i Płatności Częściowe

    // Częściowo opłacona faktura sprzedażowa do Projektu Pompowni (Przychód)
    const invoice1 = await prisma.invoice.create({
        data: {
            tenantId: tenant.id,
            contractorId: contractor2.id,
            projectId: projectPump.id,
            type: 'SPRZEDAŻ',
            amountNet: 30000.00,
            amountGross: 36900.00,
            taxRate: 0.23,
            issueDate: new Date('2026-03-01'),
            dueDate: new Date('2026-03-15'),
            status: 'PARTIALLY_PAID', // Oczekiwana modyfikacja z zadania
            scanUrl: 'https://storage.nasza-firma.pl/faktury/fv-01-2026.pdf',
        }
    })

    // Transakcja stanowiąca częściową spłatę Factury (np. Zaliczka wpłynęła na konto)
    const zaliczka = await prisma.transaction.create({
        data: {
            tenantId: tenant.id,
            projectId: projectPump.id,
            amount: 15000.00,
            type: 'PRZYCHÓD',
            transactionDate: new Date('2026-03-05'),
            category: 'Zaliczka',
        }
    })

    // Powiązanie tej transakcji z Fakturą poprzez tabelę relacyjną "Payment"
    await prisma.payment.create({
        data: {
            invoiceId: invoice1.id,
            transactionId: zaliczka.id,
            amountApplied: 15000.00
        }
    })

    // Koszty Materiałowe do projektu Elektrycznego (Wydatki)
    await prisma.transaction.create({
        data: {
            tenantId: tenant.id,
            projectId: projectElec.id,
            amount: 45000.00,
            type: 'KOSZT',
            transactionDate: new Date('2026-03-02'),
            category: 'Materiały (Kable, Koryta)',
            scanUrl: 'https://storage.nasza-firma.pl/skany/hurtownia-1.jpg',
        }
    })

    await prisma.transaction.create({
        data: {
            tenantId: tenant.id,
            projectId: projectElec.id,
            amount: 15000.00,
            type: 'KOSZT',
            transactionDate: new Date('2026-03-08'),
            category: 'Robocizna Podwykonawcy',
        }
    })

    // 8. Logowanie Audytu (Audit Trail)
    await prisma.auditLog.create({
        data: {
            tenantId: tenant.id,
            userId: adminUser.id,
            action: 'GENERATED_SEED_DATA',
            entity: 'System',
            entityId: 'ALL',
            details: {
                message: 'System został zainicjowany przy użyciu skryptu seed.',
                affectedProjects: [projectElec.id, projectPump.id]
            }
        }
    })

    console.log('Zakończono wstrzykiwanie danych testowych z Multi-tenancy!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
