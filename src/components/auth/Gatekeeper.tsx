"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword, updatePassword } from "firebase/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Lock, LogOut, ShieldCheck, KeyRound, UserCheck } from "lucide-react"
import { Input } from "@/components/ui/input"

// WHITELIST (CEO & WSPÓLNIK)
const AUTHORIZED_EMAILS = [
  "adisarecki@go2.pl", // CEO
  "t.grabolus@gmail.com" // Wspólnik
]

export function Gatekeeper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        const whitelisted = AUTHORIZED_EMAILS.includes(u.email || "")
        setIsAuthorized(whitelisted)

        if (whitelisted) {
          // Sprawdzamy flagę w Firestore
          try {
            const userRef = doc(db, "users", u.uid)
            const userSnap = await getDoc(userRef)
            if (userSnap.exists() && userSnap.data().requirePasswordChange) {
              setIsChangingPassword(true)
            }
          } catch (err) {
            console.error("Błąd sprawdzania flagi hasła:", err)
          }
        }
      } else {
        setUser(null)
        setIsAuthorized(false)
        setIsChangingPassword(false)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      console.error("Email Login failed", err)
      
      // Mapowanie błędów Firebase na polskie komunikaty
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          setError("Błędny e-mail lub hasło.")
          break
        case 'auth/user-disabled':
          setError("Konto zostało zablokowane.")
          break
        case 'auth/too-many-requests':
          setError("Zbyt wiele prób logowania. Spróbuj później.")
          break
        case 'auth/network-request-failed':
          setError("Błąd połączenia z siecią.")
          break
        default:
          setError("Wystąpił nieoczekiwany błąd logowania.")
      }
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("Hasła nie pasują do siebie.")
      return
    }
    if (newPassword.length < 8) {
      setError("Nowe hasło musi mieć min. 8 znaków.")
      return
    }
    if (user && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword)
        // Aktualizujemy flagę w Firestore
        const userRef = doc(db, "users", user.uid)
        await updateDoc(userRef, {
          requirePasswordChange: false,
          updatedAt: new Date().toISOString()
        })
        setIsChangingPassword(false)
      } catch (err: any) {
        console.error("Password change failed", err)
        setError("Błąd podczas zmiany hasła. Spróbuj się przelogować.")
      }
    }
  }

  const handleLogout = () => {
    signOut(auth)
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold tracking-widest uppercase text-xs opacity-50">Autoryzacja Gatekeeper...</p>
        </div>
      </div>
    )
  }

  if (isChangingPassword) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-950 text-white p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]" />
        </div>
        
        <div className="z-10 bg-white/5 border border-white/10 p-12 rounded-[2.5rem] shadow-2xl backdrop-blur-xl text-center max-w-md w-full">
           <div className="w-20 h-20 bg-emerald-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/20">
              <KeyRound className="w-10 h-10 text-white" />
           </div>
           <h1 className="text-3xl font-black italic tracking-tight mb-4 uppercase">Wymień Klucze</h1>
           <p className="text-slate-300 font-medium mb-8">System wykrył hasło tymczasowe. Ustaw teraz swoje prywatne hasło dostępu.</p>
           
           <form onSubmit={handleChangePassword} className="space-y-4">
              <Input 
                type="password" 
                placeholder="Nowe Hasło" 
                className="bg-white/10 border-white/20 text-white h-14 rounded-xl"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input 
                type="password" 
                placeholder="Powtórz Nowe Hasło" 
                className="bg-white/10 border-white/20 text-white h-14 rounded-xl"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {error && <p className="text-rose-400 text-sm font-bold">{error}</p>}
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-14 rounded-2xl text-lg font-black shadow-xl">
                Zapisz i Wejdź
              </Button>
           </form>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]" />
           <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[120px]" />
        </div>
        
        <div className="z-10 bg-white/5 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl text-center max-w-md w-full">
           <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
              <Lock className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-4xl font-black italic tracking-tight mb-2">SIG ERP</h1>
           <p className="text-slate-400 font-medium mb-8 text-sm">System Operacyjny Fort Knox</p>
           
           <form onSubmit={handleEmailLogin} className="space-y-4">
               <Input 
                type="email" 
                placeholder="E-mail" 
                className="bg-white/10 border-white/20 text-white h-12 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
               />
               <Input 
                type="password" 
                placeholder="Hasło" 
                className="bg-white/10 border-white/20 text-white h-12 rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
               />
               {error && <p className="text-rose-400 text-sm font-bold">{error}</p>}
               <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-14 rounded-2xl text-lg font-black shadow-xl">
                 Zaloguj
               </Button>
           </form>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-rose-950 text-white p-6">
        <div className="bg-white/5 border border-white/10 p-12 rounded-[2.5rem] shadow-2xl backdrop-blur-xl text-center max-w-md w-full">
           <div className="w-20 h-20 bg-rose-600 rounded-3xl mx-auto flex items-center justify-center mb-8">
              <ShieldCheck className="w-10 h-10 text-white" />
           </div>
           <h1 className="text-3xl font-black tracking-tight mb-4 uppercase">Brak Uprawnień</h1>
           <p className="text-rose-100 font-medium mb-12">Twój e-mail ({user.email}) nie znajduje się na liście autoryzowanej CEO/Partner.</p>
           
           <Button 
             onClick={handleLogout} 
             variant="outline"
             className="w-full border-rose-300 text-rose-300 hover:bg-rose-900/50 h-14 rounded-2xl text-lg font-black gap-3"
           >
             <LogOut className="w-6 h-6" /> Wyloguj
           </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
