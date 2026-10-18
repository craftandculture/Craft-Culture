/**
 * C&C's bond at London City Bond, Burton, as a merchant sending wine needs it
 *
 * The one place these are written down: the instructions a member passes on
 * and anything else that names the bond read from here.
 */
const lcbBurton = {
  name: 'London City Bond, Burton Gateway',
  /** C&C's own reference with LCB, which a merchant transferring wine asks for */
  reference: 'CRACBG',
  addressLines: ['Unit 2 Gateway Road', 'Barton under Needwood'],
  postcode: 'DE13 8FL',
  goodsInEmail: 'bggoodsin@lcb.co.uk',
} as const;

export default lcbBurton;
