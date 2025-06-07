import { forwardRef, ElementRef, ComponentPropsWithoutRef, HTMLAttributes, ComponentProps, ReactNode, ComponentType, createContext, useContext, useId, useMemo, useState, useCallback, useEffect, CSSProperties } from "react"

function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
