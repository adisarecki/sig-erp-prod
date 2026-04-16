"use client"

import { useState, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import {
    Car,
    Wrench,
    Monitor,
    Package,
    Calendar,
    ChevronRight,
    MapPin,
    User,
    PenTool
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const categoryIcons = {
    vehicle: <Car className="w-4 h-4" />,
    tool: <Wrench className="w-4 h-4" />,
    it: <Monitor className="w-4 h-4" />,
    equipment: <Package className="w-4 h-4" />
}

const statusColors = {
    ACTIVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    INACTIVE: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    DAMAGED: "bg-rose-100 text-rose-700 hover:bg-rose-200",
    SOLD: "bg-blue-100 text-blue-700 hover:bg-blue-200"
}

export function AssetsTable({ assets }: { assets: any[] }) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const filteredAssets = selectedCategory
        ? assets.filter(a => a.category === selectedCategory)
        : assets

    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-6">
                <Badge
                    variant={selectedCategory === null ? "default" : "outline"}
                    className="cursor-pointer h-8 px-4 font-bold rounded-lg transition-all"
                    onClick={() => setSelectedCategory(null)}
                >
                    Wszystkie ({assets.length})
                </Badge>
                {Object.keys(categoryIcons).map(cat => (
                    <Badge
                        key={cat}
                        variant={selectedCategory === cat ? "default" : "outline"}
                        className="cursor-pointer h-8 px-4 font-bold rounded-lg transition-all flex gap-2 items-center"
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {categoryIcons[cat as keyof typeof categoryIcons]}
                        <span className="capitalize">{cat}</span>
                    </Badge>
                ))}

                <div className="flex-1" />

                <Link href="/assets/new">
                    <Button className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-sm">
                        <PenTool className="w-3.5 h-3.5 mr-2" />
                        Dodaj Ręcznie
                    </Button>
                </Link>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-4">Nazwa & Identyfikacja</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-4">Kategoria</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-4">Wartość Zakupu</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-4">Status</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-4 text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAssets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="p-12 text-center text-slate-400 font-medium bg-slate-50/20">
                                    Nie znaleziono środków trwałych w tej kategorii.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredAssets.map(asset => (
                            <TableRow 
                                key={asset.id} 
                                className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                                onClick={() => window.location.href = `/assets/${asset.id}`}
                            >
                                <TableCell className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-2 bg-slate-100 rounded-xl text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            {categoryIcons[asset.category as keyof typeof categoryIcons]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900 leading-tight">{asset.name}</p>
                                                {asset.sourceType === 'KSEF_LINKED' ? (
                                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-emerald-100 text-emerald-600 bg-emerald-50 uppercase font-bold tracking-tight">KSeF</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-slate-100 text-slate-400 uppercase font-bold tracking-tight">Manual</Badge>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                {asset.serialNumber || asset.registrationNumber || asset.vin || "Brak S/N"}
                                                {asset.sourceDocumentNumber && <span className="ml-2 text-indigo-300">• {asset.sourceDocumentNumber}</span>}
                                            </p>
                                            {(asset.location || asset.assignedTo) && (
                                                <div className="flex gap-3 mt-2">
                                                    {asset.location && (
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                                                            <MapPin className="w-3 h-3 text-slate-300" /> {asset.location}
                                                        </span>
                                                    )}
                                                    {asset.assignedTo && (
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                                                            <User className="w-3 h-3 text-slate-300" /> {asset.assignedTo}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="p-4">
                                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-wide">
                                        {asset.category}
                                    </span>
                                </TableCell>
                                <TableCell className="p-4">
                                    <div className="font-bold text-slate-800">
                                        <CurrencyDisplay gross={asset.purchaseNet} net={asset.purchaseNet} isIncome={true} hideSign={true} />
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Calendar className="w-3 h-3 text-slate-300" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                            {new Date(asset.purchaseDate).toLocaleDateString('pl-PL')}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell className="p-4">
                                    <Badge className={`${statusColors[asset.status as keyof typeof statusColors]} border-none shadow-none`}>
                                        {asset.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="p-4 text-right">
                                    <Link href={`/assets/${asset.id}`} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-indigo-600 inline-block">
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
