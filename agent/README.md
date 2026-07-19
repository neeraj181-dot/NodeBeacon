# NodeBeacon Standalone Windows Agent & Setup Wizard

A cross-platform monitoring agent and a native Windows Setup Wizard designed for infrastructure administration.

## Components

The single compiled executable (`NodeBeaconAgent.exe`) serves dual purposes based on how it is invoked:

1. **Installer (User Invocation)**:
   Double-clicking the executable launches the Tkinter GUI Setup Wizard. It asks for:
   - Backend URL
   - Server API Key
   - Refresh Polling Interval
   - When "Install" is clicked:
     1. Validates the API key by sending a test metrics request to the backend.
     2. Copies itself to `C:\Program Files\NodeBeacon Agent\NodeBeaconAgent.exe`.
     3. Creates `config.json` inside the installation folder.
     4. Installs start menu and desktop shortcuts.
     5. Registers and launches the background Windows Service.

2. **Windows Service (System Invocation)**:
   Runs in the background under the name `NodeBeaconAgent`.
   - Automatically launches with Windows.
   - Monitors CPU load, RAM utilization, Disk space, network speeds, and uptime.
   - Safely yields to system stop events using Win32 event handles.
   - Saves logs to `C:\Program Files\NodeBeacon Agent\logs\agent.log`.

---

## Installation Guide

1. Download the compiled `NodeBeaconAgent.exe` installer from your NodeBeacon dashboard.
2. Double-click the file to open the setup wizard. (Confirm the Windows UAC Administrator prompt).
3. Paste the unique API Key for your server node.
4. Click **Install**. The wizard will validate the key, place program files in `C:\Program Files\NodeBeacon Agent\`, create desktop/start menu shortcuts, and start the background monitoring service.

---

## How to Uninstall

1. Navigate to the program files directory: `C:\Program Files\NodeBeacon Agent\`.
2. Right-click **`uninstall.bat`** and click **Run as administrator**.
3. The script will stop the service, remove the service registration from Windows, delete start menu and desktop shortcuts, and clean up the config files.
4. You can then delete the empty folder directory.

---

## Troubleshooting

- **Service fails to start**: Verify you have run the installer as an administrator. Windows prevents service registration without administrator privileges.
- **Agent fails validation**: Verify that your server URL is correct and the server API Key has not been deleted on the dashboard. Check that the NodeBeacon server backend is running and accessible from the machine.
- **Log inspection**: Check service logs inside `C:\Program Files\NodeBeacon Agent\logs\agent.log` for detail logs on metric collection successes, timeouts, or exceptions.
