import os
import sys
import shutil
import ctypes
import subprocess
import tkinter as tk
from tkinter import messagebox, ttk
import requests
import win32com.client

# Windows Admin checks
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

def run_as_admin():
    if not is_admin():
        # Relaunch the current process with admin rights
        script = os.path.abspath(sys.argv[0])
        params = " ".join(sys.argv[1:])
        # "runas" triggers the UAC prompt
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
        sys.exit(0)

# Create Windows shortcuts
def create_shortcuts(target_exe):
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        
        # 1. Desktop Shortcut
        desktop_dir = shell.SpecialFolders("Desktop")
        desktop_shortcut = os.path.join(desktop_dir, "NodeBeacon Agent.lnk")
        shortcut = shell.CreateShortCut(desktop_shortcut)
        shortcut.TargetPath = target_exe
        shortcut.WorkingDirectory = os.path.dirname(target_exe)
        shortcut.Description = "NodeBeacon Infrastructure Monitoring Agent"
        shortcut.save()
        
        # 2. Start Menu Shortcut
        start_menu_dir = shell.SpecialFolders("Programs")
        start_menu_shortcut = os.path.join(start_menu_dir, "NodeBeacon Agent.lnk")
        shortcut_sm = shell.CreateShortCut(start_menu_shortcut)
        shortcut_sm.TargetPath = target_exe
        shortcut_sm.WorkingDirectory = os.path.dirname(target_exe)
        shortcut_sm.Description = "NodeBeacon Infrastructure Monitoring Agent"
        shortcut_sm.save()
        return True
    except Exception as e:
        print(f"Failed to create shortcuts: {e}")
        return False

# GUI Setup Wizard class
class SetupWizard:
    def __init__(self, root):
        self.root = root
        self.root.title("NodeBeacon Agent Setup")
        self.root.geometry("450x380")
        self.root.resizable(False, False)
        
        # Style configurations
        self.style = ttk.Style()
        self.style.theme_use('vista')
        
        # Container frame
        self.frame = ttk.Frame(root, padding="24")
        self.frame.grid(row=0, column=0, sticky=(tk.N, tk.S, tk.E, tk.W))
        
        # Heading
        self.title_lbl = ttk.Label(
            self.frame, 
            text="NodeBeacon Agent Setup", 
            font=("Segoe UI", 16, "bold")
        )
        self.title_lbl.grid(row=0, column=0, columnspan=2, pady=(0, 16), sticky=tk.W)

        self.desc_lbl = ttk.Label(
            self.frame,
            text="This wizard will install the NodeBeacon Monitoring Agent as a system service. Please paste your Server API Key below to verify deployment.",
            wraplength=400,
            font=("Segoe UI", 9)
        )
        self.desc_lbl.grid(row=1, column=0, columnspan=2, pady=(0, 20), sticky=tk.W)

        # Fields
        # 1. Backend URL
        ttk.Label(self.frame, text="Backend Metrics URL:", font=("Segoe UI", 9, "bold")).grid(row=2, column=0, sticky=tk.W, pady=4)
        self.url_var = tk.StringVar(value="http://127.0.0.1:8000/api/metrics/")
        self.url_entry = ttk.Entry(self.frame, textvariable=self.url_var, width=42)
        self.url_entry.grid(row=3, column=0, columnspan=2, sticky=tk.W, pady=(0, 12))

        # 2. API Key
        ttk.Label(self.frame, text="Server API Key:", font=("Segoe UI", 9, "bold")).grid(row=4, column=0, sticky=tk.W, pady=4)
        self.key_var = tk.StringVar()
        self.key_entry = ttk.Entry(self.frame, textvariable=self.key_var, show="*", width=42)
        self.key_entry.grid(row=5, column=0, columnspan=2, sticky=tk.W, pady=(0, 12))

        # 3. Interval
        ttk.Label(self.frame, text="Poll Interval (Seconds):", font=("Segoe UI", 9, "bold")).grid(row=6, column=0, sticky=tk.W, pady=4)
        self.interval_var = tk.StringVar(value="10")
        self.interval_entry = ttk.Entry(self.frame, textvariable=self.interval_var, width=15)
        self.interval_entry.grid(row=7, column=0, sticky=tk.W, pady=(0, 20))

        # Buttons Panel
        self.btn_frame = ttk.Frame(self.frame)
        self.btn_frame.grid(row=8, column=0, columnspan=2, sticky=tk.E, pady=(10, 0))

        self.cancel_btn = ttk.Button(self.btn_frame, text="Cancel", command=self.root.quit)
        self.cancel_btn.pack(side=tk.LEFT, padx=6)

        self.install_btn = ttk.Button(self.btn_frame, text="Install", command=self.start_installation)
        self.install_btn.pack(side=tk.LEFT)

    def validate_api_key(self, url, api_key):
        # Sends a minor test metric heartbeat to check API key authentication
        headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
        dummy_payload = {
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'disk_usage': 0.0,
            'network_in': 0,
            'network_out': 0,
            'uptime': 0
        }
        try:
            r = requests.post(url, json=dummy_payload, headers=headers, timeout=5)
            return r.status_code == 201
        except Exception:
            return False

    def start_installation(self):
        url = self.url_var.get().strip()
        api_key = self.key_var.get().strip()
        interval_str = self.interval_var.get().strip()

        if not url or not api_key or not interval_str:
            messagebox.showerror("Error", "All configuration fields are required.")
            return

        try:
            interval = int(interval_str)
            if interval <= 0:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Error", "Poll Interval must be a positive integer.")
            return

        # Disable buttons during validation/install
        self.install_btn.config(state="disabled")
        self.cancel_btn.config(state="disabled")
        self.root.update()

        # Validate API Key
        valid = self.validate_api_key(url, api_key)
        if not valid:
            messagebox.showerror("Authentication Failed", "Invalid Server API Key or Backend unreachable. Please verify configuration settings.")
            self.install_btn.config(state="normal")
            self.cancel_btn.config(state="normal")
            return

        # Procedural File Installation
        try:
            install_dir = r"C:\Program Files\NodeBeacon Agent"
            app_data_dir = r"C:\ProgramData\NodeBeacon"
            
            # Create directories
            os.makedirs(install_dir, exist_ok=True)
            os.makedirs(app_data_dir, exist_ok=True)
            os.makedirs(os.path.join(app_data_dir, "logs"), exist_ok=True)

            # Copy current executable to installation directory
            if getattr(sys, 'frozen', False):
                exe_source = sys.executable
            else:
                exe_source = sys.argv[0]
            target_exe = os.path.join(install_dir, "NodeBeaconAgent.exe")
            
            # Shutil copy file (only if not already running from there)
            if os.path.abspath(exe_source).lower() != os.path.abspath(target_exe).lower():
                shutil.copy2(exe_source, target_exe)

            # Save config.json to C:\ProgramData\NodeBeacon\
            import json
            config_data = {
                "server_url": url,
                "api_key": api_key,
                "interval": interval
            }
            with open(os.path.join(app_data_dir, "config.json"), 'w') as f:
                json.dump(config_data, f, indent=4)

            # Create uninstaller script
            uninstaller_path = os.path.join(install_dir, "uninstall.bat")
            with open(uninstaller_path, 'w') as f:
                f.write(f'@echo off\n')
                f.write(f'echo Stopping and deleting NodeBeaconAgent service...\n')
                f.write(f'"{target_exe}" remove\n')
                f.write(f'echo Removing shortcuts...\n')
                f.write(f'del "%USERPROFILE%\\Desktop\\NodeBeacon Agent.lnk" 2>nul\n')
                f.write(f'del "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\NodeBeacon Agent.lnk" 2>nul\n')
                f.write(f'echo Deleting application data...\n')
                f.write(f'rmdir /s /q "{app_data_dir}" 2>nul\n')
                f.write(f'echo Deleting uninstall script...\n')
                f.write(f'del /f /q "{os.path.join(install_dir, "uninstall.bat")}" 2>nul\n')
                f.write(f'echo NodeBeacon Agent uninstalled successfully.\n')
                f.write(f'pause\n')


            # Create shortcuts
            create_shortcuts(target_exe)

            # Register & Start service
            subprocess.run([target_exe, "install"], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
            subprocess.run([target_exe, "start"], check=True, creationflags=subprocess.CREATE_NO_WINDOW)

            messagebox.showinfo("Success", "NodeBeacon Agent installed and started successfully!")
            self.root.quit()

        except Exception as e:
            messagebox.showerror("Installation Error", f"Failed to complete installation: {e}")
            self.install_btn.config(state="normal")
            self.cancel_btn.config(state="normal")

def run_installer_gui():
    # Enforce admin privilege escalation
    run_as_admin()
    
    root = tk.Tk()
    app = SetupWizard(root)
    root.mainloop()
