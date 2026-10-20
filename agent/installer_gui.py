# GUI installation for the existing NodeBeacon Windows service.
import ctypes
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import winreg
import tkinter as tk
from tkinter import messagebox, ttk

import requests
import win32service
import win32serviceutil
import win32com.client
from config import VERSION, data_dir, save_config
from runtime import validate_url

SERVICE_NAME = 'NodeBeaconAgent'
INSTALL_DIR = Path(r'C:\Program Files\NodeBeacon Agent')

def is_admin():
    return bool(ctypes.windll.shell32.IsUserAnAdmin())

def run_as_admin():
    from desktop import elevate
    if not elevate():
        sys.exit(0)

def create_shortcuts(target_exe):
    shell = win32com.client.Dispatch('WScript.Shell')
    for folder in ('Desktop', 'Programs'):
        path = Path(shell.SpecialFolders(folder)) / 'NodeBeacon Agent.lnk'
        shortcut = shell.CreateShortCut(str(path))
        shortcut.TargetPath = str(target_exe)
        shortcut.WorkingDirectory = str(INSTALL_DIR)
        shortcut.Description = 'NodeBeacon monitoring controls'
        shortcut.save()

def register_uninstaller(target):
    with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\NodeBeaconAgent') as key:
        for name, value in {'DisplayName': 'NodeBeacon Agent', 'DisplayVersion': VERSION,
                            'Publisher': 'NodeBeacon', 'InstallLocation': str(INSTALL_DIR),
                            'UninstallString': f'"{target}" --uninstall', 'DisplayIcon': str(target)}.items():
            winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)

def install_service(target_exe):
    command = f'"{target_exe}" --service'
    try:
        win32serviceutil.QueryServiceStatus(SERVICE_NAME)
        subprocess.run(['sc.exe', 'config', SERVICE_NAME, 'binPath=', command, 'start=', 'auto'],
            check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    except win32service.error as exc:
        if exc.winerror != 1060:
            raise
        subprocess.run(['sc.exe', 'create', SERVICE_NAME, 'binPath=', command, 'start=', 'auto',
            'DisplayName=', 'NodeBeacon Monitoring Agent'], check=True, capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW)
    win32serviceutil.StartService(SERVICE_NAME)
    win32serviceutil.WaitForServiceStatus(SERVICE_NAME, win32service.SERVICE_RUNNING, 30)

class SetupWizard:
    def __init__(self, root):
        self.root = root
        root.title('NodeBeacon Setup')
        root.geometry('530x420')
        self.bootstrap = None
        self.registered = None
        self.message = tk.StringVar(value='Download the configured ZIP from your website and extract all files before installation.')
        executable_dir = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
        path = executable_dir / 'enrollment.json'
        try:
            if path.exists():
                self.bootstrap = json.loads(path.read_text(encoding='utf-8'))
                self.message.set(f"Ready to install for {self.bootstrap['device_name']}.\nManagement server: {self.bootstrap['management_url']}\nInstallation authorization expires after 30 minutes.")
        except (OSError, ValueError, KeyError):
            self.message.set('Installation configuration is invalid. Download a new package.')
        frame = ttk.Frame(root, padding=28)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='NodeBeacon Agent', font=('Segoe UI', 22, 'bold')).pack(anchor='w', pady=12)
        ttk.Label(frame, textvariable=self.message, wraplength=460, justify='left').pack(anchor='w', pady=12)
        ttk.Label(frame, text='Installs an automatic Windows service with visible Start/Stop controls.\nInstall only on a PC you are authorized to monitor.', wraplength=460).pack(anchor='w', pady=12)
        self.button = ttk.Button(frame, text='Install NodeBeacon', command=self.start_installation)
        self.button.pack(anchor='w', pady=12)
        self.button.config(state='normal' if self.bootstrap else 'disabled')
        ttk.Button(frame, text='Cancel', command=root.destroy).pack(anchor='w')

    def start_installation(self):
        if not getattr(sys, 'frozen', False):
            messagebox.showerror('Build required', 'Run the compiled NodeBeaconAgent.exe to install the Windows service.')
            return
        self.button.config(state='disabled')
        self.root.update()
        try:
            origin = validate_url(self.bootstrap['management_url']).rstrip('/')
            INSTALL_DIR.mkdir(parents=True, exist_ok=True)
            directory = data_dir()
            directory.mkdir(parents=True, exist_ok=True)
            # Protect machine-scoped credentials from other local users.
            subprocess.run(['icacls.exe', str(directory), '/inheritance:r', '/grant:r',
                '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'],
                check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            target = INSTALL_DIR / 'NodeBeaconAgent.exe'
            try:
                state = win32serviceutil.QueryServiceStatus(SERVICE_NAME)[1]
                if state != win32service.SERVICE_STOPPED:
                    win32serviceutil.StopService(SERVICE_NAME)
                    win32serviceutil.WaitForServiceStatus(SERVICE_NAME, win32service.SERVICE_STOPPED, 30)
            except win32service.error as exc:
                if exc.winerror != 1060:
                    raise
            if Path(sys.executable).resolve() != target.resolve():
                shutil.copy2(sys.executable, target)
                dependencies = Path(sys.executable).parent / '_internal'
                if not dependencies.is_dir():
                    raise ValueError('Extract the entire setup ZIP, including _internal, before installing.')
                shutil.copytree(dependencies, INSTALL_DIR / '_internal', dirs_exist_ok=True)
            if self.registered is None:
                response = requests.post(origin + '/api/servers/agents/register/',
                    json={'token': self.bootstrap['enrollment_token']},
                    timeout=(5, 15), allow_redirects=False)
                if response.status_code != 201:
                    raise ValueError('Enrollment failed or expired. Download a new package from the website.')
                self.registered = response.json()
                if str(self.registered.get('device_id')) != str(self.bootstrap.get('device_id')):
                    self.registered = None
                    raise ValueError('Installation device identity mismatch.')
            config = {**self.registered, 'management_url': origin, 'enabled': True}
            save_config(config)
            create_shortcuts(target)
            (INSTALL_DIR / 'uninstall.bat').write_text(
                '@echo off\r\n"' + str(target) + '" --uninstall\r\n', encoding='utf-8')
            install_service(target)
            register_uninstaller(target)
            self.message.set('Installed successfully. Open NodeBeacon from your desktop to view status or stop monitoring.')
            self.button.config(text='Open controls', command=self.open_controls, state='normal')
        except (requests.RequestException, OSError, ValueError, KeyError, subprocess.CalledProcessError, win32service.error):
            # Avoid displaying URLs, payloads, or tokens in exception details.
            messagebox.showerror('NodeBeacon installation', 'Installation could not complete. Check network/server availability, extract all ZIP files, and approve administrator access.')
            self.button.config(state='normal')

    def open_controls(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        from desktop import ControlPanel
        ControlPanel(self.root)

def run_installer_gui():
    run_as_admin()
    root = tk.Tk()
    SetupWizard(root)
    root.mainloop()
