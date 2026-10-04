/** A person's name as shown on screen: first letter of each word capitalised */
const personName = (name: string) => name.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());

export default personName;
