import { TooltipHelp } from "@/components/ui/TooltipHelp"

export default function FinancePage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Finanse i Cash Flow</h1>
                    <p className="text-slate-500 mt-1">Wszystkie transakcje, faktury i zaciągnięte wyciągi z banku.</p>
                </div>
                <div className="space-x-2 flex items-center">
                    <div className="inline-flex items-center">
                        <TooltipHelp content="Pobiera czyste surowe operacje w formacie Open Banking (Tabela BankTransactionRaw). Te kwoty nie mają przypisanego projektu dopóki ich nie sparujesz z wydatkiem." />
                        <button className="bg-slate-100 text-slate-900 border px-4 py-2 rounded-md hover:bg-slate-200 transition">
                            Import z Banku
                        </button>
                    </div>
                    <div className="inline-flex items-center">
                        <TooltipHelp content="Bezpośrednie zapisanie wydatku z faktury lub paragonu (Tabela Transactions). Określa rzeczywisty koszt dla konkretnego Projektu, zanim fizycznie zapłacisz te pieniądze przelewem." />
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                            Zarejestruj Koszt
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-500">
                Historia transakcji jest pusta. Zaimportuj wyciąg bankowy, aby powiązać koszty.
            </div>
        </div>
    );
}
