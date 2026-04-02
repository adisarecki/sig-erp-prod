import { cn } from "@/lib/utils"

interface TableWrapperProps {
  children: React.ReactNode
  className?: string
}

export function TableWrapper({ children, className }: TableWrapperProps) {
  return (
    <div className={cn("w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent", className)}>
      <div className="inline-block min-w-full align-middle">
        {children}
      </div>
    </div>
  )
}
