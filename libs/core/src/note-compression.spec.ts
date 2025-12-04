import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

describe('note compression', () => {
  it('should round-trip special characters via lz-string', () => {
    const original =
      'Hello, 世界! 🔒\nLine 2 with symbols: ~!@#$%^&*()_+-={}[]|;:\'",.<>?/` and emojis 🚀🔥';

    const compressed = compressToEncodedURIComponent(original);
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = decompressFromEncodedURIComponent(compressed);
    expect(decompressed).toBe(original);
  });

  it('should produce deterministic compression for the same input', () => {
    const text =
      'Deterministic ✅\nSpecial chars: äöü ß ñ ç\nMore symbols: ©®™✓ and emojis 😃😜';

    const first = compressToEncodedURIComponent(text);
    const second = compressToEncodedURIComponent(text);

    expect(first).toBe(second);
    expect(decompressFromEncodedURIComponent(first)).toBe(text);
    expect(decompressFromEncodedURIComponent(second)).toBe(text);
  });
});
