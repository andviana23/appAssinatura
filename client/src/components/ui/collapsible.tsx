import { forwardRef, ElementRef, ComponentPropsWithoutRef, HTMLAttributes, ComponentProps, ReactNode, ComponentType, createContext, useContext, useId, useMemo, useState, useCallback, useEffect, CSSProperties } from "react"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
