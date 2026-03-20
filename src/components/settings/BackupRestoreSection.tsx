"use client"

import { useState, useRef } from "react"
import { Download, Upload, ShieldCheck, FileJson, AlertCircle, CheckCircle2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { exportBackup, restoreFromBackup } from "@/app/actions/backup"

export function BackupRestoreSection() {
    const [isExporting, setIsExporting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [showRestoreModal, setShowRestoreModal] = useState(false)
    const [password, setPassword] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const result = await exportBackup()
            if (result.success) {
                const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                const date = new Date().toISOString().split('T')[0]
                link.href = url
                link.download = `sig_erp_backup_${date}.json`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            }
        } catch (error) {
            alert("Błąd eksportu: " + (error as Error).message)
        } finally {
            setIsExporting(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const handleRestoreInitiate = () => {
        if (!selectedFile) {
            alert("Proszę najpierw wybrać plik kopii zapasowej (.json)")
            return
        }
        setShowRestoreModal(true)
    }

    const handleRestoreConfirm = async () => {
        if (!password) {
            alert("Hasło autoryzacyjne jest wymagane.")
            return
        }

        setIsImporting(true)
        try {
            const reader = new FileReader()
            reader.onload = async (e) => {
                try {
                    const jsonData = JSON.parse(e.target?.result as string)
                    const result = await restoreFromBackup(jsonData, password)
                    if (result.success) {
                        alert(result.message)
                        window.location.reload()
                    }
                } catch (err) {
                    alert("Błąd podczas przetwarzania pliku: " + (err as Error).message)
                    setIsImporting(false)
                }
            }
            reader.readAsText(selectedFile!)
        } catch (error) {
            alert("Błąd importu: " + (error as Error).message)
            setIsImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 border-b pb-4">
                    <div className="flex items-center gap-2 text-blue-600">
                        <ShieldCheck className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">Kopia Zapasowa (Skarbiec)</CardTitle>
                    </div>
                    <CardDescription>
                        Pobierz pełną zawartość systemu w jednym pliku JSON. Zalecane przed każdą większą zmianą konfiguracji.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <FileJson className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">Pełny Eksport Danych</p>
                                <p className="text-xs text-slate-500">Zawiera Firestore, SQL (Neon) oraz metadane projektu.</p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleExport} 
                            disabled={isExporting}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 font-bold flex items-center gap-2 shadow-lg shadow-blue-100"
                        >
                            {isExporting ? <span className="animate-pulse">Generowanie...</span> : <><Download className="w-4 h-4" /> Pobierz kopię (.json)</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-amber-50 border-b pb-4">
                    <div className="flex items-center gap-2 text-amber-700">
                        <AlertCircle className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">Odtwarzanie Systemu</CardTitle>
                    </div>
                    <CardDescription className="text-amber-800/70 font-medium">
                        Wgraj dane z pliku kopii zapasowej. <strong>UWAGA: Aktualne dane zostaną całkowicie nadpisane!</strong>
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="grid w-full items-center gap-3">
                            <Label htmlFor="backup-file" className="font-bold text-slate-700">Wybierz plik kopii (.json)</Label>
                            <div className="flex flex-col md:flex-row gap-3">
                                <Input 
                                    id="backup-file" 
                                    type="file" 
                                    accept=".json"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="flex-1 cursor-pointer file:font-bold file:text-blue-600 file:bg-blue-50 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-4 hover:border-blue-300 transition-colors" 
                                />
                                <Button 
                                    onClick={handleRestoreInitiate}
                                    disabled={!selectedFile || isImporting}
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold h-10 px-6"
                                >
                                    <Upload className="w-4 h-4 mr-2" /> Odtwórz z pliku
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Autoryzacji */}
            <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-600">
                            <Lock className="w-5 h-5" />
                            Wymagana Autoryzacja
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 pt-2 font-medium">
                            Odtwarzanie bazy danych jest operacją krytyczną. Podaj hasło systemowe przekazane przez administratora, aby kontynuować.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="backup-password">Hasło autoryzacyjne *</Label>
                            <Input 
                                id="backup-password" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Wpisz hasło..."
                                className="h-12 text-lg border-slate-200 focus:ring-red-500"
                            />
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-bold uppercase tracking-tight">
                            Status: Dane zostaną trwale nadpisane.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowRestoreModal(false)} disabled={isImporting} className="h-12 flex-1">Anuluj</Button>
                        <Button 
                            onClick={handleRestoreConfirm} 
                            disabled={isImporting || !password}
                            className="h-12 flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-xl"
                        >
                            {isImporting ? "Odtwarzanie..." : "Uruchom Import"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
