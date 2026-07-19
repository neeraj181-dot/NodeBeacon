import os
import json
import sys

def load_config():
    # Resolve app data directory dynamically (ProgramData in production, local dir in development)
    if getattr(sys, 'frozen', False):
        app_data_dir = r"C:\ProgramData\NodeBeacon"
    else:
        app_data_dir = os.path.dirname(os.path.abspath(__file__))
        
    config_path = os.path.join(app_data_dir, 'config.json')

    if not os.path.exists(config_path):
        print(f"Error: Configuration file not found at {config_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Basic validation
        if not config.get('server_url'):
            print("Error: 'server_url' is missing in config.json", file=sys.stderr)
            sys.exit(1)
            
        return config
    except json.JSONDecodeError:
        print("Error: config.json contains invalid JSON formatting", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        sys.exit(1)
