import { SyncStatus } from "./SyncStatus";
import { MobileNav } from "./MobileNav";

export function Navbar() {
    return (
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
                <MobileNav />
                <h2 className="text-lg font-bold tracking-tight text-slate-800 md:hidden">
                    SIG<span className="text-blue-600"> ERP</span>
                </h2>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
                <SyncStatus />
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    AD
                </div>
            </div>
        </header>
    );
}
