"""Stop the service before removing its narrowly scoped installation files."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import stat
import winreg
import tempfile
from tkinter import messagebox
import win32com.client
import win32service
import win32serviceutil
from config import data_dir
from desktop import elevate

def uninstall():
    if not elevate():
        return
    from main import SingleInstance
    ui_lock = SingleInstance('UI')
    try:
        if not ui_lock.acquired:
            messagebox.showerror('Close NodeBeacon', 'Close the NodeBeacon control window before uninstalling.')
            return
        install = Path(r'C:\Program Files\NodeBeacon Agent').resolve()
        directory_raw = data_dir()
        directory = directory_raw.resolve()
        expected_data = (Path(os.environ.get('PROGRAMDATA', r'C:\ProgramData')) / 'NodeBeacon').resolve()
        if not getattr(sys, 'frozen', False) or directory != expected_data or install.parent != Path(r'C:\Program Files').resolve():
            raise ValueError('Uninstall is available only from the installed Windows application.')
        for candidate in (directory_raw, Path(r'C:\Program Files\NodeBeacon Agent')):
            if candidate.exists() and candidate.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise ValueError('Refusing to remove a redirected installation directory.')
        if not messagebox.askyesno('Uninstall NodeBeacon', 'Stop monitoring and remove NodeBeacon configuration and local logs? Website metrics are retained.'):
            return
        try:
            if win32serviceutil.QueryServiceStatus('NodeBeaconAgent')[1] != win32service.SERVICE_STOPPED:
                win32serviceutil.StopService('NodeBeaconAgent')
                win32serviceutil.WaitForServiceStatus('NodeBeaconAgent', win32service.SERVICE_STOPPED, 30)
            subprocess.run(['sc.exe', 'delete', 'NodeBeaconAgent'], check=True, capture_output=True,
                           creationflags=subprocess.CREATE_NO_WINDOW)
        except win32service.error as exc:
            if exc.winerror != 1060:
                raise
        shell = win32com.client.Dispatch('WScript.Shell')
        for name in ('Desktop', 'Programs'):
            (Path(shell.SpecialFolders(name)) / 'NodeBeacon Agent.lnk').unlink(missing_ok=True)
        try:
            winreg.DeleteKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\NodeBeaconAgent')
        except FileNotFoundError:
            pass
        if directory.is_dir():
            shutil.rmtree(directory)
        # A native PowerShell helper waits for exactly this process to exit.
        fd, helper = tempfile.mkstemp(prefix='NodeBeacon-uninstall-', suffix='.ps1')
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write("$ErrorActionPreference = 'Stop'\n"
                f"Wait-Process -Id {os.getpid()} -ErrorAction SilentlyContinue\n"
                "$taskTarget = [IO.Path]::GetFullPath('C:\\Program Files\\NodeBeacon Agent')\n"
                "if ($taskTarget -ne 'C:\\Program Files\\NodeBeacon Agent') { exit 1 }\n"
                "Remove-Item -LiteralPath $taskTarget -Recurse -Force\n"
                "Remove-Item -LiteralPath $PSCommandPath -Force\n")
        subprocess.Popen(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper],
                         creationflags=subprocess.CREATE_NO_WINDOW, close_fds=True)
        messagebox.showinfo('NodeBeacon removed', 'Service removed. Program files will be removed after this window closes. Website data is unchanged.')
    except (OSError, ValueError, subprocess.CalledProcessError, win32service.error):
        messagebox.showerror('Uninstall incomplete', 'Check administrator access and close other NodeBeacon windows. No unrelated folders were removed.')
    finally:
        ui_lock.close()
