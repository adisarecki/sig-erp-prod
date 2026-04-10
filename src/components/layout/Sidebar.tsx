import Link from "next/link";
import { LayoutDashboard, Building2, Briefcase, DollarSign, Settings, DownloadCloud, HelpCircle } from "lucide-react";

export function Sidebar() {
    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tighter">SIG<span className="text-blue-500"> ERP</span></h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
                <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Dashboard</span>
                </Link>
                <Link href="/crm" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
                    <Building2 className="w-5 h-5" />
                    <span>Kontrahenci</span>
                </Link>
                <Link href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
                    <Briefcase className="w-5 h-5" />
                    <span>Projekty</span>
                </Link>
                <Link href="/finanse" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
                    <DollarSign className="w-5 h-5" />
                    <span>Finanse</span>
                </Link>
                <Link href="/finanse/ksef" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-indigo-300">
                    <DownloadCloud className="w-5 h-5" />
                    <span>Inbox KSeF</span>
                </Link>
                <Link href="/help" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors border-t border-slate-800/50 mt-2 pt-2 text-indigo-200">
                    <HelpCircle className="w-5 h-5" />
                    <span className="font-bold">Baza Wiedzy</span>
                </Link>
            </nav>
            <div className="p-4 border-t border-slate-800">
                <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
                    <Settings className="w-5 h-5" />
                    <span>Ustawienia</span>
                </Link>
            </div>
        </aside>
    );
}
