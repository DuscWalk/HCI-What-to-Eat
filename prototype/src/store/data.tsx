import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Coupon, Dish, OrderRecord, Shop } from '../types';

interface DataValue {
  loading: boolean;
  shops: Shop[];
  orders: OrderRecord[];
  coupons: Coupon[];
  shopById: Map<string, Shop>;
  dishById: Map<string, Dish>;
}

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listShops(), api.listOrderHistory(), api.listCoupons()]).then(([s, o, c]) => {
      if (!alive) return;
      setShops(s);
      setOrders(o);
      setCoupons(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<DataValue>(() => {
    const shopById = new Map(shops.map((s) => [s.id, s]));
    const dishById = new Map(shops.flatMap((s) => s.dishes.map((d) => [d.id, d] as const)));
    return { loading, shops, orders, coupons, shopById, dishById };
  }, [loading, shops, orders, coupons]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider');
  return value;
}
