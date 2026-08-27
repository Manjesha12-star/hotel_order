import { Flame, Minus, Plus, Star, ChefHat } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney, SPICE_LABEL, type MenuItem } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      aria-label={isVeg ? "Vegetarian" : "Non vegetarian"}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-[3px] border",
        isVeg ? "border-veg" : "border-nonveg",
      )}
    >
      <span className={cn("size-2 rounded-full", isVeg ? "bg-veg" : "bg-nonveg")} />
    </span>
  );
}

export function MenuItemCard({
  item,
  quantity,
  onAdd,
  onChange,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onChange: (q: number) => void;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <article className="animate-rise flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28">
        {item.image_url && !broken ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn(
              "size-full object-cover transition-transform duration-500 hover:scale-105",
              !item.is_available && "grayscale",
            )}
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            {item.name.slice(0, 1)}
          </div>
        )}
        {!item.is_available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-background">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start gap-2">
          <VegMark isVeg={item.is_veg} />
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold leading-snug">{item.name}</h3>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.is_popular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
              <Star className="size-3" /> Popular
            </span>
          )}
          {item.is_chef_special && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              <ChefHat className="size-3" /> Chef special
            </span>
          )}
          {item.spice_level > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-nonveg"
              title={SPICE_LABEL[item.spice_level]}
            >
              {Array.from({ length: item.spice_level }).map((_, i) => (
                <Flame key={i} className="size-3" />
              ))}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-display text-base font-semibold">{formatMoney(item.price)}</span>
          {quantity > 0 ? (
            <div className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 p-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full text-primary"
                aria-label={`Remove one ${item.name}`}
                onClick={() => onChange(quantity - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center text-sm font-bold text-primary">{quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full text-primary"
                aria-label={`Add one ${item.name}`}
                onClick={() => onChange(quantity + 1)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-9 rounded-full px-5 font-semibold"
              disabled={!item.is_available}
              onClick={onAdd}
            >
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
