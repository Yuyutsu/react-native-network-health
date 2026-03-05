// Minimal stub types — avoids circular import from the real package.
type NetInfoState = {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details: null;
};
type NetInfoSubscription = () => void;

type NetInfoChangeHandler = (state: NetInfoState) => void;

let currentState: NetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: null,
};

const handlers: Set<NetInfoChangeHandler> = new Set();

const NetInfo = {
  addEventListener: jest.fn((handler: NetInfoChangeHandler): NetInfoSubscription => {
    handlers.add(handler);
    // Emit initial state immediately (mirrors real NetInfo behaviour)
    handler(currentState);
    return () => {
      handlers.delete(handler);
    };
  }),

  fetch: jest.fn((): Promise<NetInfoState> => Promise.resolve(currentState)),

  /** Test helper — push a new state to all subscribers. */
  __setState(state: Partial<NetInfoState>): void {
    currentState = { ...currentState, ...state };
    handlers.forEach((h) => h(currentState));
  },

  /** Test helper — reset to default online/wifi state. */
  __reset(): void {
    currentState = {
      type: "wifi",
      isConnected: true,
      isInternetReachable: true,
      details: null,
    };
    handlers.clear();
    jest.clearAllMocks();
  },
};

export default NetInfo;
export type { NetInfoState, NetInfoSubscription };


