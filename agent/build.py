import sys
import os
import PyInstaller.__main__

def build():
    print("=========================================")
    print("NodeBeacon Agent Compiler Script")
    print("=========================================")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(current_dir, "main.py")
    
    # Define PyInstaller build options
    pyinstaller_args = [
        os.path.join(current_dir, 'NodeBeaconAgent.spec'),
        "--noconfirm",
        f"--distpath={os.path.join(current_dir, 'dist')}",
        f"--workpath={os.path.join(current_dir, 'build')}",
    ]
    
    print(f"Building {main_script} using PyInstaller...")
    try:
        PyInstaller.__main__.run(pyinstaller_args)
        print("\n[SUCCESS] Built agent/dist/NodeBeaconAgent/NodeBeaconAgent.exe. Keep _internal beside it.")
    except Exception as e:
        print(f"\n[ERROR] Build failed: {e}")
        raise

if __name__ == '__main__':
    build()
