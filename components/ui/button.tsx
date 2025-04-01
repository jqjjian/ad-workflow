import * as React from 'react'

const buttonVariants = {
    default: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-gray-300 bg-transparent hover:bg-gray-50',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'hover:bg-gray-100',
    link: 'text-primary underline-offset-4 hover:underline'
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof buttonVariants
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', ...props }, ref) => {
        const baseClasses =
            'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

        return (
            <button
                className={`${baseClasses} ${buttonVariants[variant]} ${className}`}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
