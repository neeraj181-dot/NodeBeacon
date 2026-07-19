import os
import sys
import logging
import win32serviceutil
import win32service
import win32event
import servicemanager

# Resolve app data directory path (ProgramData in production, local directory in development)
if getattr(sys, 'frozen', False):
    app_data_dir = r"C:\ProgramData\NodeBeacon"
else:
    app_data_dir = os.path.dirname(os.path.abspath(__file__))
    
log_file = os.path.join(app_data_dir, "logs", "agent.log")

try:
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    # Initialize standard logging
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
except Exception as e:
    print(f"Error: Failed to initialize logging: {e}", file=sys.stderr)
    sys.exit(1)

# Set path relative loader to find config.json in app data path
sys.path.insert(0, app_data_dir)



# Official pywin32 Windows Service Framework class
class NodeBeaconAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "NodeBeaconAgent"
    _svc_display_name_ = "NodeBeacon Monitoring Agent"
    _svc_description_ = "NodeBeacon Infrastructure Monitoring Agent"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.is_running = True

    def SvcStop(self):
        logging.info("Service stopping: Received stop signal.")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        self.is_running = False

    def SvcDoRun(self):
        # Report start pending to the SCM
        self.ReportServiceStatus(win32service.SERVICE_START_PENDING)
        logging.info("Service starting...")
        
        # Report started running to the SCM (Resolves Error 1053)
        self.ReportServiceStatus(win32service.SERVICE_RUNNING)
        logging.info("Service started successfully.")
        
        try:
            self.main()
        except Exception as e:
            logging.critical(f"Unhandled exception in SvcDoRun: {e}", exc_info=True)
            self.ReportServiceStatus(win32service.SERVICE_STOPPED)
            sys.exit(1)
            
        self.ReportServiceStatus(win32service.SERVICE_STOPPED)
        logging.info("Service stopped.")

    def main(self):
        # Verify config.json exists before starting
        config_path = os.path.join(app_data_dir, "config.json")
        if not os.path.exists(config_path):
            logging.error(f"Configuration file config.json not found in {app_data_dir}. Service stopping.")
            return


        try:
            # Imports occur inside service runtime - not during module import
            from config import load_config
            from collector import collect_all
            from sender import send_metrics
            
            config = load_config()
            server_url = config['server_url']
            api_key = config['api_key']
            interval = config.get('interval', 10)
        except Exception as e:
            logging.error(f"Failed to load config: {e}. Exiting service.", exc_info=True)
            return

        logging.info(f"Monitoring loop active. Target: {server_url}, Interval: {interval}s")

        while self.is_running:
            try:
                logging.info("Collecting metrics...")
                metrics = collect_all()
                api_payload = {
                    'cpu_usage': metrics['cpu_usage'],
                    'memory_usage': metrics['memory_usage'],
                    'disk_usage': metrics['disk_usage'],
                    'network_in': metrics['network_in'],
                    'network_out': metrics['network_out'],
                    'uptime': metrics['uptime']
                }
                
                logging.info("Uploading metrics...")
                success = send_metrics(server_url, api_key, api_payload)
                if success:
                    logging.info(f"Upload success: CPU={metrics['cpu_usage']}%, RAM={metrics['memory_usage']}%")
                else:
                    logging.error("Upload failed: Server returned error or timeout.")
            except Exception as e:
                logging.error(f"Unhandled exception in metrics loop: {e}", exc_info=True)

            # Sleep for the configured interval, or wake up instantly on service stop event
            result = win32event.WaitForSingleObject(self.hWaitStop, interval * 1000)
            if result == win32event.WAIT_OBJECT_0:
                break


# Run in interactive console mode
def run_console():
    import time
    
    # Imports occur inside service runtime - not during module import
    from config import load_config
    from collector import collect_all
    from sender import send_metrics

    logging.info("Starting agent in console mode.")
    print("NodeBeacon Agent running in console mode. Press Ctrl+C to exit.")
    
    config_path = os.path.join(app_data_dir, "config.json")
    if not os.path.exists(config_path):
        print(f"Error: Configuration file config.json not found in {app_data_dir}")
        logging.error(f"Configuration file config.json not found in {app_data_dir}")
        sys.exit(1)

    
    try:
        config = load_config()
        server_url = config['server_url']
        api_key = config['api_key']
        interval = config.get('interval', 10)
    except Exception as e:
        print(f"Error: Failed to load config: {e}")
        logging.error(f"Failed to load config: {e}", exc_info=True)
        sys.exit(1)

    print(f"Target URL: {server_url}")
    print(f"Interval:   {interval}s")

    while True:
        try:
            print("Collecting metrics...")
            metrics = collect_all()
            api_payload = {
                'cpu_usage': metrics['cpu_usage'],
                'memory_usage': metrics['memory_usage'],
                'disk_usage': metrics['disk_usage'],
                'network_in': metrics['network_in'],
                'network_out': metrics['network_out'],
                'uptime': metrics['uptime']
            }
            print("Uploading metrics...")
            success = send_metrics(server_url, api_key, api_payload)
            if success:
                print(f"Upload success: CPU={metrics['cpu_usage']}% | RAM={metrics['memory_usage']}%")
                logging.info(f"Console metrics uploaded: CPU={metrics['cpu_usage']}%, RAM={metrics['memory_usage']}%")
            else:
                print("Upload failed.")
                logging.error("Console metrics upload failed.")
        except KeyboardInterrupt:
            print("\nStopping console monitoring agent...")
            break
        except Exception as e:
            print(f"Error: {e}")
            logging.error(f"Error in console metrics loop: {e}", exc_info=True)
            
        time.sleep(interval)


if __name__ == '__main__':
    # Route execution based on CLI arguments
    if len(sys.argv) > 1 and sys.argv[1] in ['install', 'remove', 'start', 'stop', 'restart', 'debug']:
        try:
            # Handle Windows service control commands
            win32serviceutil.HandleCommandLine(NodeBeaconAgentService)
        except Exception as e:
            print(f"Service command failed: {e}")
    elif len(sys.argv) > 1 and sys.argv[1] == '--console':
        run_console()
    else:
        # Check if local configuration file exists
        config_path = os.path.join(app_data_dir, "config.json")
        if os.path.exists(config_path):
            run_console()
        else:
            # Run Setup Wizard GUI
            from installer_gui import run_installer_gui
            run_installer_gui()

