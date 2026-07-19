import os
import sys
import time
import socket
import platform
import psutil

def get_cpu():
    # Enforces a brief 0.5s check to return a valid compute utilization percentage
    return psutil.cpu_percent(interval=0.5)

def get_memory():
    return psutil.virtual_memory().percent

def get_disk():
    # Use C:\ for Windows system partition, otherwise use '/'
    path = 'C:\\' if sys.platform == 'win32' else '/'
    try:
        return psutil.disk_usage(path).percent
    except Exception:
        # Fallback to current path if root is inaccessible
        return psutil.disk_usage(os.path.abspath(os.sep)).percent

def get_network():
    try:
        counters = psutil.net_io_counters()
        return {
            'bytes_sent': counters.bytes_sent,
            'bytes_recv': counters.bytes_recv
        }
    except Exception:
        return {
            'bytes_sent': 0,
            'bytes_recv': 0
        }

def get_uptime():
    try:
        boot_time = psutil.boot_time()
        current_time = time.time()
        return int(current_time - boot_time)
    except Exception:
        return 0

def get_hostname():
    return socket.gethostname()

def get_os():
    return f"{platform.system()} {platform.release()}"

def collect_all():
    net = get_network()
    return {
        'cpu_usage': get_cpu(),
        'memory_usage': get_memory(),
        'disk_usage': get_disk(),
        'network_out': net['bytes_sent'],
        'network_in': net['bytes_recv'],
        'uptime': get_uptime(),
        'hostname': get_hostname(),
        'operating_system': get_os()
    }
