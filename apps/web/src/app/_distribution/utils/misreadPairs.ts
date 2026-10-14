/**
 * Names the same wine has been entered under, where one is a misreading
 *
 * Sophie's list, from reconciling City Drinks' sheets against ours. Each is one
 * wine recorded twice because a name was transcribed by eye from a document:
 * `Fournier` for Fourrier, `Debours Maisonnelle` for Dehours Maisoncelle. No
 * amount of string distance decides these safely — "Fournier" and "Fourrier"
 * differ by one letter and so do plenty of genuinely different estates — so
 * they are listed rather than inferred, and a person still confirms each one.
 *
 * Held here rather than in the query so the list is visible, reviewable, and
 * can be added to by anyone who finds the next one.
 */
const MISREAD_PAIRS: { wrong: string; right: string; note: string }[] = [
  { wrong: 'Fournier', right: 'Fourrier', note: 'Domaine Fourrier' },
  {
    wrong: 'Debours Maisonnelle',
    right: 'Dehours Maisoncelle',
    note: 'Dehours et Fils, Maisoncelle',
  },
  {
    wrong: 'Rachiel Wientjes',
    right: 'Racines Wenzlau',
    note: 'Racines, Wenzlau Vineyard',
  },
  {
    wrong: 'Fraggnano Pravo',
    right: 'Fregonese Prapò',
    note: 'Fregonese, Prapò',
  },
  { wrong: 'Terre Elysse', right: 'Terre Elysée', note: 'Terre Elysée' },
];

export default MISREAD_PAIRS;
