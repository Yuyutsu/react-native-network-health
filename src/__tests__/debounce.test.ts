import { debounce } from "../utils/debounce";

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls the function after the specified delay", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on repeated calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced();
    jest.advanceTimersByTime(100);
    debounced();
    jest.advanceTimersByTime(100);
    // 200ms have passed since first call but only 100ms since second
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the underlying function", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("hello", 42);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("hello", 42);
  });

  it("cancel prevents the pending call from firing", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("can fire again after cancel", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    debounced();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
