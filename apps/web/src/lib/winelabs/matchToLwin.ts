import parseMatchResponse from './parseMatchResponse';
import winelabsFetch from './winelabsFetch';

/**
 * Ask Wine Labs which wine a free-text name is
 *
 * The answer is a suggestion only: Wine Labs can return a different wine from
 * the same producer, so staff confirm before it is used anywhere.
 *
 * @param query - Producer, wine and vintage as free text
 * @returns The suggested LWIN, or null when Wine Labs finds no match
 */
const matchToLwin = async (query: string) =>
  parseMatchResponse(await winelabsFetch('match_to_lwin', { query }));

export default matchToLwin;
