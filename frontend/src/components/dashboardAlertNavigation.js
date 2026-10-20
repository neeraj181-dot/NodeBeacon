export function openActiveAlerts(activeAlerts, setFilters, navigate) {
  if (activeAlerts.length === 0) return false;

  setFilters(current => ({
    ...current,
    status: 'Active',
    severity: '',
    server: '',
  }));
  navigate('alerts');
  return true;
}
