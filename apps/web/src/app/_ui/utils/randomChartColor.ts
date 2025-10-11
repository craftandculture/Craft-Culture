const colorMap = {
  'blue-100': 'oklch(97.32% 0.0141 251.56)',
  'blue-200': 'oklch(96.29% 0.0195 250.59)',
  'blue-300': 'oklch(94.58% 0.0293 249.84870859673202)',
  'blue-400': 'oklch(91.58% 0.0473 245.11621922481282)',
  'blue-500': 'oklch(82.75% 0.0979 248.48)',
  'blue-600': 'oklch(73.08% 0.1583 248.133320980386)',
  'blue-700': 'oklch(57.61% 0.2508 258.23)',
  'blue-800': 'oklch(51.51% 0.2399 257.85)',
  'blue-900': 'oklch(53.18% 0.2399 256.9900584162342)',
  'blue-1000': 'oklch(26.67% 0.1099 254.34)',
  'red-100': 'oklch(96.5% 0.0223 13.09)',
  'red-200': 'oklch(95.41% 0.0299 14.252646656611997)',
  'red-300': 'oklch(94.33% 0.0369 15.011509923860523)',
  'red-400': 'oklch(91.51% 0.0471 19.8)',
  'red-500': 'oklch(84.47% 0.1018 17.71)',
  'red-600': 'oklch(71.12% 0.1881 21.22)',
  'red-700': 'oklch(62.56% 0.2524 23.03)',
  'red-800': 'oklch(58.19% 0.2482 25.15)',
  'red-900': 'oklch(54.99% 0.232 25.29)',
  'red-1000': 'oklch(24.8% 0.1041 18.86)',
  'amber-100': 'oklch(97.48% 0.0331 85.79)',
  'amber-200': 'oklch(96.81% 0.0495 90.24227879900472)',
  'amber-300': 'oklch(95.93% 0.0636 90.52)',
  'amber-400': 'oklch(91.02% 0.1322 88.25)',
  'amber-500': 'oklch(86.55% 0.1583 79.63)',
  'amber-600': 'oklch(80.25% 0.1953 73.59)',
  'amber-700': 'oklch(81.87% 0.1969 76.46)',
  'amber-800': 'oklch(77.21% 0.1991 64.28)',
  'amber-900': 'oklch(52.79% 0.1496 54.65)',
  'amber-1000': 'oklch(30.83% 0.099 45.48)',
  'green-100': 'oklch(97.59% 0.0289 145.42)',
  'green-200': 'oklch(96.92% 0.037 147.15)',
  'green-300': 'oklch(94.6% 0.0674 144.23)',
  'green-400': 'oklch(91.49% 0.0976 146.24)',
  'green-500': 'oklch(85.45% 0.1627 146.3)',
  'green-600': 'oklch(80.25% 0.214 145.18)',
  'green-700': 'oklch(64.58% 0.1746 147.27)',
  'green-800': 'oklch(57.81% 0.1507 147.5)',
  'green-900': 'oklch(51.75% 0.1453 147.65)',
  'green-1000': 'oklch(29.15% 0.1197 147.38)',
  'teal-100': 'oklch(97.72% 0.0359 186.7)',
  'teal-200': 'oklch(97.06% 0.0347 180.66)',
  'teal-300': 'oklch(94.92% 0.0478 182.07)',
  'teal-400': 'oklch(92.76% 0.0718 183.78)',
  'teal-500': 'oklch(86.88% 0.1344 182.42)',
  'teal-600': 'oklch(81.5% 0.161 178.96)',
  'teal-700': 'oklch(64.92% 0.1572 181.95)',
  'teal-800': 'oklch(57.53% 0.1392 181.66)',
  'teal-900': 'oklch(52.08% 0.1251 182.93)',
  'teal-1000': 'oklch(32.11% 0.0788 179.82)',
  'purple-100': 'oklch(96.65% 0.0244 312.1890119359961)',
  'purple-200': 'oklch(96.73% 0.0228 309.8)',
  'purple-300': 'oklch(94.85% 0.0364 310.15)',
  'purple-400': 'oklch(91.77% 0.0614 312.82)',
  'purple-500': 'oklch(81.26% 0.1409 310.8)',
  'purple-600': 'oklch(72.07% 0.2083 308.19)',
  'purple-700': 'oklch(55.5% 0.3008 306.12)',
  'purple-800': 'oklch(48.58% 0.2638 305.73)',
  'purple-900': 'oklch(47.18% 0.2579 304)',
  'purple-1000': 'oklch(23.96% 0.13 305.66)',
  'pink-100': 'oklch(95.69% 0.0359 344.6218910697224)',
  'pink-200': 'oklch(95.71% 0.0321 353.14)',
  'pink-300': 'oklch(93.83% 0.0451 356.29)',
  'pink-400': 'oklch(91.12% 0.0573 358.82)',
  'pink-500': 'oklch(84.28% 0.0915 356.99)',
  'pink-600': 'oklch(74.33% 0.1547 0.24)',
  'pink-700': 'oklch(63.52% 0.238 1.01)',
  'pink-800': 'oklch(59.51% 0.2339 4.21)',
  'pink-900': 'oklch(53.5% 0.2058 2.84)',
  'pink-1000': 'oklch(26% 0.0977 359',
} as const;

const preferredColorOrder = [
  'blue',
  'red',
  'amber',
  'green',
  'teal',
  'purple',
  'pink',
];

const preferredShadeOrder = [
  '700',
  '800',
  '900',
  '600',
  '500',
  '400',
  '300',
  '200',
  '100',
  '1000',
];

const randomColor = (index = 0) => {
  const colorCount = preferredColorOrder.length;
  const shadeCount = preferredShadeOrder.length;

  const colorIndex = index % colorCount;
  const shadeIndex = Math.floor(index / colorCount) % shadeCount;

  const color = preferredColorOrder[colorIndex];
  const shade = preferredShadeOrder[shadeIndex];

  return colorMap[`${color}-${shade}` as keyof typeof colorMap];
};

export default randomColor;
