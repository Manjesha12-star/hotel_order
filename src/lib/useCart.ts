import { useCallback, useEffect, useState } from "react";
import type { CartLine, MenuItem } from "./restaurant";

const KEY = (table: number) => `saffron-cart-t${table}`;

export function useCart(tableNumber: number) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(tableNumber));
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : []);
    } catch {
      setLines([]);
    }
    setHydrated(true);
  }, [tableNumber]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY(tableNumber), JSON.stringify(lines));
  }, [lines, tableNumber, hydrated]);

  const add = useCallback((item: MenuItem, quantity = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.itemId === item.id);
      if (found) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l,
        );
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity }];
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.itemId !== itemId)
        : prev.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.min(50, quantity) } : l)),
    );
  }, []);

  const setInstructions = useCallback((itemId: string, instructions: string) => {
    setLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, instructions: instructions.slice(0, 200) } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.quantity * l.price, 0);

  return { lines, add, setQuantity, setInstructions, clear, count, total, hydrated };
}
