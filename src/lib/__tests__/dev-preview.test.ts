import { freeReaderPreview, onFreeReaderPreviewChange, setFreeReaderPreview } from "@/lib/dev-preview";

// M11's development-only "View as a free reader" (Decisions — 2026-10-01).

const globals = globalThis as unknown as { __DEV__: boolean };

afterEach(() => setFreeReaderPreview(false));

describe("the free-reader preview", () => {
  it("is off until turned on, and tells its listeners once per change", () => {
    const listener = jest.fn();
    const stop = onFreeReaderPreviewChange(listener);
    expect(freeReaderPreview()).toBe(false);

    setFreeReaderPreview(true);
    setFreeReaderPreview(true);
    expect(freeReaderPreview()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setFreeReaderPreview(false);
    expect(freeReaderPreview()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    setFreeReaderPreview(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("never turns on in a release build", () => {
    const wasDev = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      setFreeReaderPreview(true);
      expect(freeReaderPreview()).toBe(false);
    } finally {
      globals.__DEV__ = wasDev;
    }
    // Nothing was stored while it was refused.
    expect(freeReaderPreview()).toBe(false);
  });
});
