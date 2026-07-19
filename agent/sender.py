import requests
from requests.exceptions import RequestException

def send_metrics(server_url, api_key, payload):
    """
    Sends collected metrics payload to the NodeBeacon backend API.
    Handles timeouts, connection errors, and HTTP status codes gracefully without crashing.
    """
    if not api_key:
        print("Warning: API Key is not configured. Please set 'api_key' in config.json")
        return False

    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json'
    }

    try:
        # Enforce a 5-second timeout to prevent hangs
        response = requests.post(server_url, json=payload, headers=headers, timeout=5)
        
        if response.status_code == 201:
            return True
        elif response.status_code == 401:
            print("[Authentication Error] Invalid Server API Key. Please verify config.json")
        elif response.status_code == 400:
            print(f"[Validation Error] Server rejected the metrics format: {response.text}")
        else:
            print(f"[Server Error] Backend returned status code {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        print("[Timeout] Server did not respond within 5 seconds. Retrying later...")
    except requests.exceptions.ConnectionError:
        print("Waiting for backend... (Connection refused/network unreachable)")
    except RequestException as e:
        print(f"[Network Exception] Request failed: {e}")
        
    return False
