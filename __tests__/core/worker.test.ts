import { nextFrame } from '@/core/worker';

describe('nextFrame', () => {
  it('resolves on a macrotask in the test environment', async () => {
    let resolved = false;
    const p = nextFrame().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false); // not synchronous
    await p;
    expect(resolved).toBe(true);
  });
});
