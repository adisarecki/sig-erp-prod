"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LayoutDashboard, Building2, Briefcase, DollarSign, Settings, DownloadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetTrigger,
    SheetClose
} from "@/components/ui/sheet"

const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/crm", label: "Kontrahenci", icon: Building2 },
    { href: "/projects", label: "Projekty", icon: Briefcase },
    { href: "/finance", label: "Finanse", icon: DollarSign },
    { href: "/finanse/ksef", label: "Inbox KSeF", icon: DownloadCloud, className: "text-indigo-300" },
]

export function MobileNav() {
    const [open, setOpen] = React.useState(false)
    const pathname = usePathname()

    // Auto-close on route change
    React.useEffect(() => {
        setOpen(false)
    }, [pathname])

    return (
        <div className="md:hidden flex items-center pr-4">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors" aria-label="Open menu">
                        <Menu className="w-6 h-6" />
                    </button>
                </SheetTrigger>
                
                <SheetContent side="left" className="w-72 bg-slate-900 border-slate-800 p-0">
                    <SheetHeader className="p-6 text-left border-b border-slate-800">
                        <SheetTitle className="text-white text-2xl font-bold tracking-tighter">
                            SIG<span className="text-blue-500"> ERP</span>
                        </SheetTitle>
                    </SheetHeader>
                    
                    <div className="flex flex-col h-[calc(100vh-80px)]">
                        <nav className="flex-1 px-4 space-y-2 mt-4">
                            {navLinks.map((link) => (
                                <SheetClose asChild key={link.href}>
                                    <Link 
                                        href={link.href} 
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-md hover:bg-slate-800 transition-colors text-lg font-medium",
                                            pathname === link.href ? "bg-slate-800 text-blue-400" : "text-slate-300",
                                            link.className
                                        )}
                                    >
                                        <link.icon className="w-6 h-6" />
                                        <span>{link.label}</span>
                                    </Link>
                                </SheetClose>
                            ))}
                        </nav>

                        <div className="p-4 border-t border-slate-800">
                            <SheetClose asChild>
                                <Link 
                                    href="/settings" 
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-md hover:bg-slate-800 transition-colors text-lg text-slate-300",
                                        pathname === "/settings" && "text-white"
                                    )}
                                >
                                    <Settings className="w-6 h-6" />
                                    <span>Ustawienia</span>
                                </Link>
                            </SheetClose>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
