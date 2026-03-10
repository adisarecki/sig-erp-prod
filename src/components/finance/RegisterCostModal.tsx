"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle } from "lucide-react"
import { addTransaction } from "@/app/actions/transactions"
import { useFormStatus } from "react-dom"

interface Project {
    id: string
    name: string
}

interface RegisterCostModalProps {
    projects: Project[]
}

export function RegisterCostModal({ projects }: RegisterCostModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            const result = await addTransaction(formData)
            if (result.success) {
                setOpen(false)
            }
        } catch (error: any) {
            alert(error.message || "Błąd podczas zapisywania kosztu.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95">
                    <PlusCircle className="h-4 w-4" />
                    Zarejestruj koszt
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-slate-200">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-slate-900">Zarejestruj Nowy Koszt</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Wprowadź dane wydatku. Zostanie on przypisany do wybranego projektu i uwzględniony w analityce.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit} className="space-y-5 mt-4">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-slate-700 font-semibold">Kwota (PLN)</Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                required
                                className="h-11 border-slate-200 focus:ring-orange-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-slate-700 font-semibold">Data</Label>
                                <Input
                                    id="date"
                                    name="date"
                                    type="date"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    required
                                    className="h-11 border-slate-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category" className="text-slate-700 font-semibold">Kategoria</Label>
                                <Select name="category" defaultValue="MATERIAŁY">
                                    <SelectTrigger className="h-11 border-slate-200">
                                        <SelectValue placeholder="Wybierz kategorię" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MATERIAŁY">Materiały</SelectItem>
                                        <SelectItem value="ROBOCIZNA">Robocizna</SelectItem>
                                        <SelectItem value="SPRZĘT">Sprzęt</SelectItem>
                                        <SelectItem value="PALIWO">Paliwo</SelectItem>
                                        <SelectItem value="BIURO">Biuro</SelectItem>
                                        <SelectItem value="INNE">Inne</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="projectId" className="text-slate-700 font-semibold">Projekt (Opcjonalnie)</Label>
                            <Select name="projectId" defaultValue="NONE">
                                <SelectTrigger className="h-11 border-slate-200">
                                    <SelectValue placeholder="Wybierz projekt" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">Brak przypisania</SelectItem>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-slate-700 font-semibold">Opis (Opcjonalnie)</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Np. Faktura za beton B25..."
                                className="min-h-[80px] border-slate-200"
                            />
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t border-slate-100 flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="flex-1 h-11"
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            {isLoading ? "Zapisywanie..." : "Dodaj Koszt"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
