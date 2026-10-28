import describePcoLine from './describePcoLine';
import type { OrderEmailSnapshot } from './orderEmailTypes';

const WINES_SHOWN = 8;

/**
 * The wine list for an order email: up to eight wines, then a count of the rest
 *
 * @param order - The order's lines
 * @returns The title, the wines shown and the line for the rest, each a list
 *   of zero or more items as the template expects
 */
const orderEmailWines = (order: OrderEmailSnapshot) => {
  const lines = order.items.map((item) => {
    const line = describePcoLine({ quantity: item.quantity, caseConfig: item.caseConfig, bottleSize: item.bottleSize });
    const name =
      item.vintage && !item.productName.includes(item.vintage) ? `${item.productName} ${item.vintage}` : item.productName;
    return {
      name,
      detail: [item.region, line.pack].filter(Boolean).join(' · '),
      quantity: line.count,
      bottles: line.bottles,
    };
  });

  const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);
  const shown = lines.slice(0, WINES_SHOWN);
  const rest = lines.slice(WINES_SHOWN);
  const restBottles = rest.reduce((sum, line) => sum + line.bottles, 0);
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  return {
    winesTitle: lines.length
      ? [{ title: `In this order · ${plural(lines.length, 'wine', 'wines')} · ${plural(bottles, 'bottle', 'bottles')}` }]
      : [],
    wines: shown.map(({ name, detail, quantity }) => ({ name, detail, quantity })),
    winesMore: rest.length
      ? [{ text: `And ${plural(rest.length, 'more wine', 'more wines')}, ${plural(restBottles, 'bottle', 'bottles')}. The full list is on the order.` }]
      : [],
  };
};

export default orderEmailWines;
