"""Visible control panel; monitoring belongs exclusively to the Windows service."""
import ctypes
import json
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox, ttk
import win32service
import win32serviceutil

from config import VERSION, data_dir, load_config, save_config

SERVICE_NAME = 'NodeBeaconAgent'


def elevate():
    if ctypes.windll.shell32.IsUserAnAdmin():
        return True
    args = sys.argv[1:] if getattr(sys, 'frozen', False) else sys.argv
    result = ctypes.windll.shell32.ShellExecuteW(None, 'runas', sys.executable,
        subprocess.list2cmdline(args), None, 1)
    if result <= 32:
        messagebox.showerror('NodeBeacon', 'Administrator permission is required for installation and service controls.')
    return False


class ControlPanel:
    def __init__(self, root):
        self.root = root
        root.title('NodeBeacon Agent')
        root.geometry('530x445')
        frame = ttk.Frame(root, padding=28)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='NodeBeacon Agent', font=('Segoe UI', 22, 'bold')).pack(anchor='w')
        self.status = tk.StringVar(value='Loading…')
        self.details = tk.StringVar()
        self.unlock_status = tk.StringVar(value='Unlock alert: no event received yet')
        self.error = tk.StringVar()
        ttk.Label(frame, textvariable=self.status, font=('Segoe UI', 15)).pack(anchor='w', pady=16)
        ttk.Label(frame, textvariable=self.details, justify='left', wraplength=470).pack(anchor='w')
        ttk.Label(frame, textvariable=self.unlock_status, wraplength=470).pack(anchor='w', pady=(8, 0))
        ttk.Label(frame, textvariable=self.error, foreground='#b03030', wraplength=470).pack(anchor='w', pady=12)
        self.button = ttk.Button(frame, text='Start agent', command=self.toggle)
        self.button.pack(anchor='w', pady=12)
        ttk.Label(frame, text='Closing this window keeps monitoring active. Use Stop agent to stop it.').pack(anchor='w')
        self.running = False
        self.service_available = False
        self.refresh()

    def refresh(self):
        try:
            config = load_config()
            try:
                service_state = win32serviceutil.QueryServiceStatus(SERVICE_NAME)[1]
                self.service_available = True
            except Exception:
                service_state = win32service.SERVICE_STOPPED
                self.service_available = False
            if self.service_available:
                self.running = service_state in (win32service.SERVICE_RUNNING, win32service.SERVICE_START_PENDING, win32service.SERVICE_STOP_PENDING)
            else:
                from main import SingleInstance
                worker = SingleInstance('Worker')
                self.running = not worker.acquired
                worker.close()
            status = {}
            try:
                status = json.loads((data_dir() / 'status.json').read_text(encoding='utf-8'))
            except (OSError, ValueError):
                pass
            self.status.set(status.get('status', 'Connecting') if self.running else ('Error' if status.get('status') == 'Error' else 'Stopped'))
            self.details.set(f"Server: {config['server_url']}\nPort: {config.get('server_port') or 'Default'}\nDevice: {config.get('device_name', 'This PC')}\nDevice ID: {config.get('device_id', 'Legacy installation')}\nLast connected: {status.get('last_success') or 'Not yet'}\nVersion: {VERSION}")
            try:
                unlock = json.loads((data_dir() / 'unlock-status.json').read_text(encoding='utf-8'))
                self.unlock_status.set(f"Unlock alert: {unlock.get('status', 'Unknown')} — {unlock.get('detail', '')}")
            except (OSError, ValueError):
                self.unlock_status.set('Unlock alert: waiting for a Windows laptop unlock event')
            self.error.set(status.get('error', '') if self.running or status.get('status') == 'Error' else '')
            self.button.config(text='Stop agent' if self.running else 'Start agent')
        except Exception:
            self.error.set('Configuration unavailable. Download a configured installer from your website.')
        self.root.after(2000, self.refresh)

    def toggle(self):
        try:
            config = load_config()
            if self.running:
                if self.service_available:
                    win32serviceutil.StopService(SERVICE_NAME)
                    win32serviceutil.WaitForServiceStatus(SERVICE_NAME, win32service.SERVICE_STOPPED, 30)
                config = load_config()
                config['enabled'] = False
                save_config(config)
                self.running = False
            else:
                config['enabled'] = True
                save_config(config)
                if self.service_available:
                    win32serviceutil.StartService(SERVICE_NAME)
                else:
                    from pathlib import Path
                    command = [sys.executable, '--console'] if getattr(sys, 'frozen', False) else [
                        sys.executable, str(Path(__file__).with_name('main.py')), '--console']
                    subprocess.Popen(command, cwd=str(Path(__file__).parent),
                        creationflags=subprocess.CREATE_NO_WINDOW)
                self.running = True
            self.error.set('')
        except Exception as exc:
            messagebox.showerror('NodeBeacon service control', str(exc))


def run_desktop():
    if not elevate():
        return
    from main import SingleInstance
    lock = SingleInstance('UI')
    root = tk.Tk()
    if not lock.acquired:
        root.withdraw()
        messagebox.showinfo('NodeBeacon', 'NodeBeacon Agent is already open.')
        root.destroy()
        lock.close()
        return
    try:
        if (data_dir() / 'config.json').exists():
            ControlPanel(root)
        else:
            from installer_gui import SetupWizard
            SetupWizard(root)
        root.mainloop()
    finally:
        lock.close()
