import * as React from 'react'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number
    max?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({ className = '', value = 0, max = 100, ...props }, ref) => {
        const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

        return (
            <div
                ref={ref}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={value}
                className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
                {...props}
            >
                <div
                    className="bg-primary h-full w-full flex-1 transition-all"
                    style={{ transform: `translateX(-${100 - percentage}%)` }}
                />
            </div>
        )
    }
)
Progress.displayName = 'Progress'

export { Progress }
