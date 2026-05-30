import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
    icon?: React.ReactNode;
  }

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, icon, children, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <select
          className={cn(
            "flex w-full appearance-none rounded-2xl border-none bg-gray-50 p-4 pe-10 text-sm font-medium text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            icon && "ps-11",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 end-0 flex items-center pe-4 pointer-events-none text-gray-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
