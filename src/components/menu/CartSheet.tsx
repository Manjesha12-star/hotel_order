import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMoney, type CartLine } from "@/lib/restaurant";

export function CartSheet({
  open,
  onOpenChange,
  lines,
  total,
  tableNumber,
  placing,
  onQuantity,
  onInstructions,
  onPlace,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lines: CartLine[];
  total: number;
  tableNumber: number;
  placing: boolean;
  onQuantity: (itemId: string, quantity: number) => void;
  onInstructions: (itemId: string, value: string) => void;
  onPlace: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl p-0">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-xl">Your order</SheetTitle>
          <SheetDescription>Table {tableNumber} · dine-in</SheetDescription>
        </SheetHeader>

        <div className="max-h-[46vh] space-y-4 overflow-y-auto px-5 py-4">
          {lines.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Your cart is empty. Add something delicious.
            </p>
          )}
          {lines.map((line) => (
            <div key={line.itemId} className="rounded-2xl border border-border bg-card p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(line.price)} × {line.quantity} ={" "}
                    <span className="font-semibold text-foreground">
                      {formatMoney(line.price * line.quantity)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-border p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    aria-label="Decrease quantity"
                    onClick={() => onQuantity(line.itemId, line.quantity - 1)}
                  >
                    {line.quantity === 1 ? (
                      <Trash2 className="size-4 text-destructive" />
                    ) : (
                      <Minus className="size-4" />
                    )}
                  </Button>
                  <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    aria-label="Increase quantity"
                    onClick={() => onQuantity(line.itemId, line.quantity + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={line.instructions ?? ""}
                onChange={(e) => onInstructions(line.itemId, e.target.value)}
                placeholder="Special instructions (less spicy, no onion…)"
                maxLength={200}
                className="mt-2 min-h-9 resize-none rounded-xl border-dashed bg-muted/40 text-xs"
                rows={1}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border bg-card px-5 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Order total</span>
            <span className="font-display text-2xl font-semibold">{formatMoney(total)}</span>
          </div>
          <Button
            size="lg"
            className="h-13 w-full rounded-full text-base font-bold"
            disabled={lines.length === 0 || placing}
            onClick={onPlace}
          >
            <ShoppingBag className="size-5" />
            {placing ? "Sending to kitchen…" : "Place order"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Orders are added to your running table bill.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
