import os
import sys
import ctypes
import shutil
import subprocess
import win32com.client

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

def run_as_admin():
    if not is_admin():
        script = os.path.abspath(sys.argv[0])
        params = " ".join(sys.argv[1:])
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
        sys.exit(0)

def uninstall():
    print("=========================================")
    print("NodeBeacon Agent Uninstaller")
    print("=========================================")
    
    run_as_admin()
    
    install_dir = r"C:\Program Files\NodeBeacon Agent"
    app_data_dir = r"C:\ProgramData\NodeBeacon"
    target_exe = os.path.join(install_dir, "NodeBeaconAgent.exe")

    # 1. Stop and remove the Windows Service
    if os.path.exists(target_exe):
        print("Stopping and removing NodeBeaconAgent service...")
        try:
            subprocess.run([target_exe, "stop"], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            subprocess.run([target_exe, "remove"], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            print("  ✓ Service stopped and removed")
        except Exception as e:
            print(f"  ✗ Failed to remove service: {e}")

    # 2. Delete Shortcuts
    print("Removing shortcuts...")
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        
        desktop_dir = shell.SpecialFolders("Desktop")
        desktop_shortcut = os.path.join(desktop_dir, "NodeBeacon Agent.lnk")
        if os.path.exists(desktop_shortcut):
            os.remove(desktop_shortcut)
            
        start_menu_dir = shell.SpecialFolders("Programs")
        start_menu_shortcut = os.path.join(start_menu_dir, "NodeBeacon Agent.lnk")
        if os.path.exists(start_menu_shortcut):
            os.remove(start_menu_shortcut)
        print("  ✓ Shortcuts deleted")
    except Exception as e:
        print(f"  ✗ Failed to delete shortcuts: {e}")

    # 3. Clean up ProgramData folder
    print("Deleting ProgramData application files...")
    try:
        if os.path.exists(app_data_dir):
            shutil.rmtree(app_data_dir)
            print("  ✓ ProgramData folder removed")
    except Exception as e:
        print(f"  ✗ Failed to remove ProgramData directory: {e}")

    # 4. Clean up Program Files folder
    print("Deleting program files...")
    try:
        if os.path.exists(install_dir):
            uninstall_bat = os.path.join(install_dir, "uninstall.bat")
            if os.path.exists(uninstall_bat):
                os.remove(uninstall_bat)
            print(f"\nUninstall finished. Please manually delete the directory: {install_dir}")
    except Exception as e:
        print(f"  ✗ Failed to delete files: {e}")

if __name__ == '__main__':
    try:
        uninstall()
    except KeyboardInterrupt:
        print("\nUninstall aborted.")
