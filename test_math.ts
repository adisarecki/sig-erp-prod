import { getAdminDb } from "./src/lib/firebaseAdmin"

async function testMargin() {
    const adminDb = getAdminDb()
    
    console.log("Mocking 1 Project, 1 Income (7500), 1 Cost (2000)...")
    
    // Create mock project
    const projectId = "test-project-" + Date.now()
    const invoice1 = {
        projectId,
        type: "SPRZEDAŻ",
        amountNet: 7500,
        amountGross: 7500
    }
    const invoice2 = {
        projectId,
        type: "EXPENSE",
        amountNet: 2000,
        amountGross: 2000
    }
    
    const project = {
        invoices: [invoice1, invoice2],
        transactions: [
            { type: "PRZYCHÓD", amount: 7500, transactionDate: new Date() },
            { type: "EXPENSE", amount: 2000, transactionDate: new Date() }
        ]
    }
    
    // Test logic from InteractiveProjectList
    const totalInvoiced = project.invoices
        .filter((inv) => inv.type === 'SPRZEDAŻ')
        .reduce((sum, inv) => sum + Number(inv.amountNet), 0)
        
    const totalCosts = project.invoices
        .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE')
        .reduce((sum, inv) => sum + Number(inv.amountNet), 0)
        
    const currentMargin = totalInvoiced - totalCosts
    
    console.log(`Przychody Netto: ${totalInvoiced} PLN`)
    console.log(`Koszty Netto: ${totalCosts} PLN`)
    console.log(`Marża: ${currentMargin} PLN`)
    
    if (currentMargin === 5500) {
        console.log("✅ SUKCES: Marża wynosi poprawnie 5500 PLN. (7500 - 2000)")
    } else {
        console.error("❌ BŁĄD: Marża jest niepoprawna!")
    }
    
    // Test logic from app/projects/[id]/page.tsx
    const cfInvoiced = project.transactions
        .filter((t: any) => t.type === 'PRZYCHÓD')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

    const cfCosts = project.transactions
        .filter((t: any) => t.type === 'KOSZT' || t.type === 'EXPENSE' || t.type === 'WYDATEK')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    
    const cfMargin = cfInvoiced - cfCosts
    
    console.log(`\nCashFlow Przychody: ${cfInvoiced} PLN`)
    console.log(`CashFlow Koszty: ${cfCosts} PLN`)
    console.log(`CashFlow Saldo: ${cfMargin} PLN`)
    
    if (cfMargin === 5500) {
        console.log("✅ SUKCES: CashFlow Saldo wynosi poprawnie 5500 PLN.")
    } else {
        console.error("❌ BŁĄD: CashFlow Saldo jest niepoprawne!")
    }
}

testMargin().catch(console.error)
