/**
 * What to show under a job title for one person's part, without repeating it
 *
 * Parts copied from the old by-person list carry the job name as a prefix
 * ("Wynn — manage transfer" under "Wynn — pricing matrix & transfer"). On a
 * screen that already shows the title, that prefix is noise: drop it, and
 * show nothing when the part only restates the title.
 *
 * @param title - The job title
 * @param what - The part's text
 * @returns The text to show, or null when it adds nothing
 */
const partLabel = (title: string, what: string) => {
  const t = title.trim().toLowerCase();
  let rest = what.trim();

  if (rest.toLowerCase() === t) return null;

  // The title was reworded after the part was written ("Rate card — update"
  // became "C&C Rate card — update"): drop the shared ending of the title.
  const low = rest.toLowerCase();
  for (let end = low.length; end >= 6; end--) {
    const shared = low.slice(0, end);
    if ((end === low.length || low[end] === ' ') && shared.includes(' — ') && t.endsWith(shared)) {
      const tail = rest.slice(end).trim();
      return tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : null;
    }
  }

  // Only titles written "Subject — task" carry a prefix worth stripping; a
  // plain title such as "Work Permits" may begin the part text naturally.
  if (!t.includes(' — ')) return rest;

  const lead = t.split(' — ')[0]!;
  for (const prefix of [`${t} — `, `${t} `, `${lead} — `, `${lead}: `]) {
    if (rest.toLowerCase().startsWith(prefix)) {
      rest = rest.slice(prefix.length).trim();
      break;
    }
  }

  if (!rest || rest.toLowerCase() === t) return null;

  return rest.charAt(0).toUpperCase() + rest.slice(1);
};

export default partLabel;
