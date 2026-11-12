import { describe, expect, it } from 'vitest';

import colourFromLivex from './wineColour';

describe('colourFromLivex', () => {
  it('reads a still wine by its colour', () => {
    expect(colourFromLivex({ colour: 'red', type: 'wine', subType: 'Still' })).toBe('red');
    expect(colourFromLivex({ colour: 'white', type: 'wine', subType: 'Still' })).toBe('white');
    expect(colourFromLivex({ colour: 'rose', type: 'wine', subType: 'Still' })).toBe('rose');
  });

  it('sells a sparkling wine as sparkling, whatever its colour', () => {
    expect(colourFromLivex({ colour: 'white', type: 'wine', subType: 'Sparkling' })).toBe('sparkling');
    expect(colourFromLivex({ colour: 'rose', type: 'wine', subType: 'Sparkling' })).toBe('sparkling');
  });

  it('reads port as fortified though Liv-ex gives it no colour', () => {
    expect(colourFromLivex({ colour: null, type: 'other', subType: 'Port' })).toBe('fortified');
    expect(colourFromLivex({ colour: 'red', type: 'fortified', subType: null })).toBe('fortified');
  });

  it('calls amber orange, and leaves a mixed or unknown wine unset', () => {
    expect(colourFromLivex({ colour: 'amber', type: 'wine', subType: 'Still' })).toBe('orange');
    expect(colourFromLivex({ colour: 'mixed', type: 'wine', subType: 'Still' })).toBeNull();
    expect(colourFromLivex({ colour: null, type: null, subType: null })).toBeNull();
  });
});
