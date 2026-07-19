export const mockServers = [
  {
    id: "srv-9821a",
    name: "prod-api-01",
    os: "Linux (Ubuntu 22.04)",
    hostname: "api-server-01.nodebeacon.net",
    status: "online",
    cpu: 42,
    memory: 68,
    disk: 54,
    networkUpload: "4.2 MB/s",
    networkDownload: "12.8 MB/s",
    uptime: "14 days, 6 hours",
    lastSeen: "Just now",
  },
  {
    id: "srv-4311b",
    name: "db-primary",
    os: "Linux (Debian 12)",
    hostname: "db-primary.nodebeacon.net",
    status: "online",
    cpu: 18,
    memory: 92,
    disk: 78,
    networkUpload: "22.5 MB/s",
    networkDownload: "18.1 MB/s",
    uptime: "45 days, 12 hours",
    lastSeen: "2s ago",
  },
  {
    id: "srv-8821c",
    name: "win-active-dir",
    os: "Windows Server 2022",
    hostname: "win-ad-01.local",
    status: "offline",
    cpu: 0,
    memory: 0,
    disk: 0,
    networkUpload: "0 KB/s",
    networkDownload: "0 KB/s",
    uptime: "Unknown",
    lastSeen: "45 minutes ago",
  },
  {
    id: "srv-1092d",
    name: "k8s-worker-node-1",
    os: "Linux (Ubuntu 22.04)",
    hostname: "k8s-node1.nodebeacon.net",
    status: "online",
    cpu: 78,
    memory: 81,
    disk: 45,
    networkUpload: "18.3 MB/s",
    networkDownload: "34.2 MB/s",
    uptime: "9 days, 2 hours",
    lastSeen: "Just now",
  }
];

export const mockAlerts = [
  {
    id: "alt-1",
    server: "db-primary",
    type: "Memory",
    message: "Memory usage > 90% (Current: 92%)",
    severity: "danger",
    time: "5 mins ago",
    status: "active"
  },
  {
    id: "alt-2",
    server: "k8s-worker-node-1",
    type: "CPU",
    message: "CPU usage > 75% (Current: 78%)",
    severity: "warning",
    time: "12 mins ago",
    status: "active"
  },
  {
    id: "alt-3",
    server: "prod-api-01",
    type: "Disk",
    message: "Disk usage > 80% resolved (Current: 54%)",
    severity: "resolved",
    time: "1 hour ago",
    status: "resolved"
  }
];

export const cpuHistoryData = [
  { time: "00:00", "prod-api-01": 35, "db-primary": 12, "k8s-worker-node-1": 65 },
  { time: "04:00", "prod-api-01": 48, "db-primary": 15, "k8s-worker-node-1": 70 },
  { time: "08:00", "prod-api-01": 40, "db-primary": 20, "k8s-worker-node-1": 85 },
  { time: "12:00", "prod-api-01": 55, "db-primary": 18, "k8s-worker-node-1": 75 },
  { time: "16:00", "prod-api-01": 42, "db-primary": 18, "k8s-worker-node-1": 78 },
  { time: "20:00", "prod-api-01": 38, "db-primary": 16, "k8s-worker-node-1": 80 },
];

export const memoryHistoryData = [
  { time: "00:00", "prod-api-01": 60, "db-primary": 88, "k8s-worker-node-1": 75 },
  { time: "04:00", "prod-api-01": 62, "db-primary": 89, "k8s-worker-node-1": 76 },
  { time: "08:00", "prod-api-01": 65, "db-primary": 90, "k8s-worker-node-1": 78 },
  { time: "12:00", "prod-api-01": 68, "db-primary": 92, "k8s-worker-node-1": 80 },
  { time: "16:00", "prod-api-01": 68, "db-primary": 92, "k8s-worker-node-1": 81 },
  { time: "20:00", "prod-api-01": 67, "db-primary": 91, "k8s-worker-node-1": 79 },
];

export const networkTrafficData = [
  { time: "00:00", Upload: 12, Download: 45 },
  { time: "04:00", Upload: 18, Download: 60 },
  { time: "08:00", Upload: 24, Download: 95 },
  { time: "12:00", Upload: 30, Download: 110 },
  { time: "16:00", Upload: 22, Download: 85 },
  { time: "20:00", Upload: 15, Download: 55 },
];
