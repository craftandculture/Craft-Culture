import seedRandom from 'seed-random';

const randomColor = (seed: string) => {
  const rng = seedRandom(seed);

  // Generate a random hue value between 0 and 360
  const hue = Math.floor(rng() * 360);

  // Set saturation to a high value for vibrant colors (70-100%)
  const saturation = Math.floor(rng() * 31) + 70;

  // Set lightness to a mid value to avoid too bright or too dark colors (50-70%)
  const lightness = Math.floor(rng() * 21) + 70;

  // Return the HSL color string
  return {
    hue,
    saturation,
    lightness,
    style: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
  };
};

export default randomColor;
