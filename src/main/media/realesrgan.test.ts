import { describe, expect, it } from 'vitest';
import { getRealEsrganNativeScale } from './realesrgan';

describe('Real-ESRGAN scale planning', () => {
  it('uses native 4x for every supported non-4x request', () => {
    expect(getRealEsrganNativeScale(2)).toBe(4);
    expect(getRealEsrganNativeScale(3)).toBe(4);
    expect(getRealEsrganNativeScale(4)).toBe(4);
    expect(getRealEsrganNativeScale(6)).toBe(4);
    expect(getRealEsrganNativeScale(8)).toBe(4);
  });

  it('rejects unsupported scales', () => {
    expect(() => getRealEsrganNativeScale(5)).toThrow('Unsupported Real-ESRGAN scale: 5.');
  });
});
