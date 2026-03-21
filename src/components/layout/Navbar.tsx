import { SyncStatus } from "./SyncStatus";

export function Navbar() {
    return (
        <header className="h-16 border-b bg-white flex items-center justify-between px-6">
            <div className="flex-1" />
            <div className="flex items-center gap-6">
                <SyncStatus />
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    AD
                </div>
            </div>
        </header>
    );
}
