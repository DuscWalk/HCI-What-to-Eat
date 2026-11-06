import type { MealKind } from '../types';

export const MEAL_LABEL: Record<MealKind, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export const MEAL_END: Record<MealKind, string> = {
  breakfast: '10:30',
  lunch: '16:00',
  dinner: '次日 5:00',
};

const ORDER: MealKind[] = ['breakfast', 'lunch', 'dinner'];

export interface MealSlot {
  kind: MealKind;
  dateKey: string;
  key: string;
  date: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 当前所处餐次。早餐 5:00–10:30，午餐 10:30–16:00，晚餐 16:00–次日 5:00。
 * shift 用于演示「进入下一餐」。
 */
export function mealAt(now: number, shift = 0): MealSlot {
  const date = new Date(now);
  const minutes = date.getHours() * 60 + date.getMinutes();
  let index: number;
  if (minutes < 5 * 60) {
    date.setDate(date.getDate() - 1);
    index = 2;
  } else if (minutes < 10 * 60 + 30) index = 0;
  else if (minutes < 16 * 60) index = 1;
  else index = 2;

  index += shift;
  date.setDate(date.getDate() + Math.floor(index / 3));
  const kind = ORDER[((index % 3) + 3) % 3];
  const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { kind, dateKey, key: `${dateKey}-${kind}`, date };
}

export function mealTitle(slot: MealSlot) {
  return `${slot.date.getMonth() + 1}月${slot.date.getDate()}日 ${MEAL_LABEL[slot.kind]}`;
}
