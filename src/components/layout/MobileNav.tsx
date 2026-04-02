"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, LayoutDashboard, Building2, Briefcase, DollarSign, Settings, DownloadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import * as DialogPrimitive from "@radix-ui/react-dialog"

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
            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
                <DialogPrimitive.Trigger asChild>
                    <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors" aria-label="Open menu">
                        <Menu className="w-6 h-6" />
                    </button>
                </DialogPrimitive.Trigger>
                
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <DialogPrimitive.Content 
                        className={cn(
                            "fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
                            "flex flex-col h-full"
                        )}
                    >
                        <div className="p-6 flex items-center justify-between">
                            <h1 className="text-2xl font-bold tracking-tighter">SIG<span className="text-blue-500"> ERP</span></h1>
                            <DialogPrimitive.Close asChild>
                                <button className="p-2 text-slate-400 hover:text-white rounded-md transition-colors" aria-label="Close menu">
                                    <X className="w-5 h-5" />
                                </button>
                            </DialogPrimitive.Close>
                        </div>

                        <nav className="flex-1 px-4 space-y-2 mt-4">
                            {navLinks.map((link) => (
                                <Link 
                                    key={link.href}
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
                            ))}
                        </nav>

                        <div className="p-4 border-t border-slate-800">
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
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    )
}
