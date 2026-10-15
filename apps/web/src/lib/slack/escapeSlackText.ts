/**
 * Escape user-supplied text for a Slack mrkdwn message
 *
 * Slack treats `<...>` as control sequences (links, @-mentions, `<!channel>`),
 * so a note, name or title containing them could ping the whole channel or
 * render a disguised link. Slack's documented escaping is `&`, `<` and `>`
 * only; formatting characters such as `*` are left alone.
 *
 * @example
 *   escapeSlackText('<!channel> see <https://evil|this>');
 *   // '&lt;!channel&gt; see &lt;https://evil|this&gt;'
 *
 * @param text - Untrusted text to place in a message
 * @returns The text with Slack control characters escaped
 */
const escapeSlackText = (text: string | null | undefined) =>
  (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default escapeSlackText;
