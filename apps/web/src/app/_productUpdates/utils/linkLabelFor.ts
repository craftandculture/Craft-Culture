import memberLinks from '../constants/memberLinks';

/**
 * The button text for a screen an update points to
 *
 * @param path - The update's link path
 * @returns The label, or null when the path is not an allowed member screen
 */
const linkLabelFor = (path: string | null) => {
  if (!path) return null;

  return (
    Object.values(memberLinks)
      .flat()
      .find((link) => link.path === path)?.label ?? null
  );
};

export default linkLabelFor;
