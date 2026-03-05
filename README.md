# react-native-network-health

A lightweight React Native utility that helps developers understand the **real quality** of network connectivity in mobile apps.

Most apps treat the network as binary — either online or offline. In practice, users frequently encounter slow networks, flaky connections, and WiFi with no real internet access. `react-native-network-health` introduces a **network health model** that surfaces these nuances.

---

## Features

- Detects **slow**, **unstable**, **offline**, and **healthy** network states
- Measures **real latency** via lightweight HEAD requests
- Tracks **reconnection frequency** to identify unstable connections
- Maintains **rolling averages** for smooth, noise-resistant readings
- **Debounces** rapid state changes to avoid UI thrashing
- Works with **React Native** and **Expo**
- Written in **strict TypeScript** — no `any`
- Zero UI assumptions — **logic only**
- **Never crashes your app** — all errors are swallowed internally

---

## Installation

```sh
npm install react-native-network-health
# peer dependency
npm install @react-native-community/netinfo
```

> **Expo users:** `@react-native-community/netinfo` is included in the Expo SDK. No extra setup needed.

---

## Quick Start

```tsx
import { useNetworkHealth } from 'react-native-network-health';

function App() {
  const network = useNetworkHealth();

  return (
    <View>
      <Text>Status: {network.status}</Text>
      <Text>Online: {String(network.isOnline)}</Text>
      <Text>Slow: {String(network.isSlow)}</Text>
      <Text>Unstable: {String(network.isUnstable)}</Text>
      <Text>Connection: {network.connectionType}</Text>
      {network.latency !== undefined && (
        <Text>Latency: {network.latency}ms</Text>
      )}
    </View>
  );
}
```

---

## Health States

| State | Description |
|---|---|
| `healthy` | Connection is stable and responsive. |
| `slow` | Online but latency exceeds the configured threshold. |
| `unstable` | Frequent disconnect/reconnect cycles detected. |
| `offline` | No connectivity. |
| `unknown` | State cannot be determined (initial state). |

---

## API

### `useNetworkHealth(config?)`

```ts
const network = useNetworkHealth({
  slowLatencyMs: 1500,            // default: 1500ms
  unstableReconnectThreshold: 3,  // default: 3 reconnections
  unstableWindowMs: 10000,        // default: 10 000ms window
  pingUrl: 'https://www.google.com', // default
  pingIntervalMs: 10000,          // default: 10 000ms
});
```

#### Return type

```ts
type NetworkHealth = {
  status: 'healthy' | 'slow' | 'unstable' | 'offline' | 'unknown';
  isOnline: boolean;
  isSlow: boolean;
  isUnstable: boolean;
  connectionType: 'wifi' | 'cellular' | 'unknown';
  latency?: number; // rolling average in ms
  on: (event: 'slow' | 'unstable' | 'offline' | 'healthy', handler: () => void) => () => void;
};
```

### Event listeners

```ts
const network = useNetworkHealth();

useEffect(() => {
  const offSlow = network.on('slow', () => {
    console.log('Network is slow — switching to low quality mode');
  });

  const offOffline = network.on('offline', () => {
    console.log('Gone offline — pausing sync');
  });

  return () => {
    offSlow();
    offOffline();
  };
}, []);
```

Available events: `slow`, `unstable`, `offline`, `healthy`.

---

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `slowLatencyMs` | `number` | `1500` | Latency threshold (ms) above which the network is deemed slow. |
| `unstableReconnectThreshold` | `number` | `3` | Number of reconnections within the window that triggers `unstable`. |
| `unstableWindowMs` | `number` | `10000` | Rolling time window (ms) for reconnection counting. |
| `pingUrl` | `string` | `https://www.google.com` | URL used for latency measurement (HEAD request). |
| `pingIntervalMs` | `number` | `10000` | Interval (ms) between automatic latency checks. |

---

## Example Use Cases

### 1. Disable video streaming on slow networks

```tsx
const network = useNetworkHealth({ slowLatencyMs: 1000 });

const videoQuality = network.isSlow ? 'low' : 'high';
```

### 2. Show a connection warning banner

```tsx
const network = useNetworkHealth();

{network.isUnstable && (
  <Banner message="Your connection is unstable. Some features may not work." />
)}
```

### 3. Delay background sync when degraded

```tsx
const network = useNetworkHealth();

useEffect(() => {
  if (network.status === 'healthy') {
    syncData();
  }
}, [network.status]);
```

### 4. Adjust API retry logic

```tsx
const network = useNetworkHealth();

const retryDelay = network.isSlow ? 5000 : 1000;
const maxRetries = network.isUnstable ? 5 : 3;
```

### 5. Expo example

```tsx
import { useNetworkHealth } from 'react-native-network-health';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  const network = useNetworkHealth();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24 }}>Network Health</Text>
      <Text>Status: {network.status}</Text>
      <Text>Latency: {network.latency ?? '—'}ms</Text>
    </View>
  );
}
```

---

## Architecture

```
src/
  hooks/
    useNetworkHealth.ts      # Public React hook
  core/
    networkMonitor.ts        # Orchestrates all detection logic
    latencyTracker.ts        # HEAD-request latency with rolling average
    stabilityTracker.ts      # Reconnection frequency within a time window
  types/
    networkTypes.ts          # All TypeScript types / interfaces
  utils/
    debounce.ts              # Generic debounce utility
  index.ts                   # Public API surface
```

### Detection approach

1. **NetInfo** — subscribes to OS-level connectivity events.
2. **Latency measurement** — fires a `HEAD` request to `pingUrl` every `pingIntervalMs` ms and records round-trip time.
3. **Rolling average** — smooths out noisy individual readings over the last 5 samples.
4. **Stability tracking** — counts connectivity-change events in a sliding time window; labels the connection `unstable` when the count reaches the threshold.
5. **Debouncing** — prevents React re-renders from flapping on rapid NetInfo events.

---

## Publishing to npm

A GitHub Actions workflow at `.github/workflows/publish.yml` automatically publishes the package when you create a GitHub Release.

**Setup:**

1. Generate an npm token at [npmjs.com](https://www.npmjs.com).
2. Add it as a repository secret named `NPM_TOKEN`.
3. Create a GitHub Release — the workflow will run `npm publish` automatically.

---

## License

MIT
