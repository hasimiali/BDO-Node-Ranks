import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
function SheetContent({ className, children, side = "left", ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) { return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out" /><DialogPrimitive.Content className={cn("fixed inset-y-0 z-50 flex w-[min(20rem,85vw)] flex-col border bg-background shadow-xl transition data-[state=open]:animate-in data-[state=closed]:animate-out", side === "left" ? "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left" : "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right", className)} {...props}>{children}<DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /><span className="sr-only">Close</span></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>; }
function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn("font-semibold", className)} {...props} />; }
function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />; }
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
