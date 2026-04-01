"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addManualAsset } from "@/app/actions/assets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardFooter, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { 
    Car, 
    Wrench, 
    Monitor, 
    Package, 
    ArrowLeft,
    Loader2,
    Calendar,
    PenTool,
    ShieldCheck
} from "lucide-react"
import Link from "next/link"

export default function NewAssetPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [category, setCategory] = useState<string>("equipment")
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const res = await addManualAsset({
                ...data,
                category: category as any,
                purchaseNet: Number(data.purchaseNet),
                purchaseGross: Number(data.purchaseGross),
                vatAmount: Number(data.purchaseGross) - Number(data.purchaseNet),
                initialValue: Number(data.purchaseNet),
                currentValue: Number(data.purchaseNet),
                mileage: data.mileage ? Number(data.mileage) : undefined,
                sourceType: 'MANUAL'
            } as any)

            if (res.success) {
                router.push('/assets')
            } else {
                setError(res.error || "Wystąpił nieoczekiwany błąd.")
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/assets" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-bold uppercase tracking-widest mb-2 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Powrót do ewidencji
                    </Link>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Nowy Środek Trwały</h1>
                    <p className="text-slate-500 font-medium">Ręczne wprowadzanie majątku do systemu SIG ERP.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-lg flex items-center gap-2">
                             <PenTool className="w-5 h-5 text-indigo-500" />
                             Podstawowe Dane
                        </CardTitle>
                        <CardDescription>Zidentyfikuj i skategoryzuj nowy środek trwały.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Nazwa Obiektu</Label>
                                <Input id="name" name="name" placeholder="np. Laptop Dell Precision 5570" required className="h-12 rounded-xl focus:ring-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Kategoria</Label>
                                <Select value={category} onValueChange={(val: string | null) => setCategory(val || "equipment")}>
                                    <SelectTrigger id="category" className="h-12 rounded-xl focus:ring-indigo-500">
                                        <SelectValue placeholder="Wybierz kategorię" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vehicle">Pojazd</SelectItem>
                                        <SelectItem value="tool">Narzędzie / Maszyna</SelectItem>
                                        <SelectItem value="it">Sprzęt IT / Elektronika</SelectItem>
                                        <SelectItem value="equipment">Inne Wyposażenie</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="purchaseDate" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Data Nabycia</Label>
                                <div className="relative">
                                    <Input id="purchaseDate" name="purchaseDate" type="date" required className="h-12 rounded-xl pl-10" />
                                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchaseNet" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Wartość Netto (PLN)</Label>
                                <Input id="purchaseNet" name="purchaseNet" type="number" step="0.01" required className="h-12 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchaseGross" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Wartość Brutto (PLN)</Label>
                                <Input id="purchaseGross" name="purchaseGross" type="number" step="0.01" required className="h-12 rounded-xl font-bold bg-slate-50" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sekcja Dynamiczna dla Pojazdów */}
                {category === 'vehicle' && (
                    <Card className="border-indigo-100 shadow-sm rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Car className="w-5 h-5 text-indigo-600" />
                                Specyfikacja Pojazdu
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="registrationNumber" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Numer Rejestracyjny</Label>
                                <Input id="registrationNumber" name="registrationNumber" placeholder="np. WX 12345" className="h-12 rounded-xl uppercase font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vin" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Numer VIN</Label>
                                <Input id="vin" name="vin" placeholder="17-znakowy numer" className="h-12 rounded-xl font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insuranceEndDate" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Koniec Ubezpieczenia</Label>
                                <Input id="insuranceEndDate" name="insuranceEndDate" type="date" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inspectionDate" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Przegląd Techniczny</Label>
                                <Input id="inspectionDate" name="inspectionDate" type="date" className="h-12 rounded-xl" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Sekcja dla IT i Narzędzi */}
                {(category === 'it' || category === 'tool') && (
                    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-lg flex items-center gap-2">
                                {category === 'it' ? <Monitor className="w-5 h-5 text-blue-500" /> : <Wrench className="w-5 h-5 text-slate-600" />}
                                Dane Identyfikacyjne
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="serialNumber" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Numer Seryjny (S/N)</Label>
                                <Input id="serialNumber" name="serialNumber" className="h-12 rounded-xl font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="brand" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Marka / Producent</Label>
                                <Input id="brand" name="brand" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedTo" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Osoba Odpowiedzialna</Label>
                                <Input id="assignedTo" name="assignedTo" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Lokalizacja</Label>
                                <Input id="location" name="location" className="h-12 rounded-xl" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                        <ShieldCheck className="w-5 h-5 text-rose-400" />
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => router.back()} className="h-14 px-8 font-bold text-slate-500 rounded-2xl hover:bg-slate-100">Anuluj</Button>
                    <Button type="submit" disabled={isLoading} className="h-14 px-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-100 rounded-2xl transition-all">
                        {isLoading ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Tworzenie...</> : "Zapisz Środek Trwały"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
