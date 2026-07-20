import api from './api';

export const login = async (username, password) => {
  const response = await api.post('auth/login/', { username, password });
  return response.data;
};

export const register = async (
  username,
  email,
  password,
  firstName = '',
  lastName = '',
  role = 'INDIVIDUAL',
  organizationName = '',
  alertEmail = ''
) => {
  const payload = {
    username,
    email,
    password,
    first_name: firstName,
    last_name: lastName,
    role,
  };

  if (role === 'ORGANIZATION_ADMIN') {
    payload.organization_name = organizationName;
    payload.alert_email = alertEmail;
  }

  const response = await api.post('auth/register/', payload);
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('auth/profile/');
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.patch('auth/profile/', profileData);
  return response.data;
};

export const sendTestEmail = async () => {
  const response = await api.post('test-email/');
  return response.data;
};

export const recoverPassword = async (email) => {
  const response = await api.post('auth/recover-password/', { email });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.post('auth/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
};

export const getOrgSettings = async () => {
  const response = await api.get('organization/settings/');
  return response.data;
};

export const updateOrgSettings = async (settingsData) => {
  const response = await api.patch('organization/settings/', settingsData);
  return response.data;
};

export const getMembers = async () => {
  const response = await api.get('organization/members/');
  return response.data;
};

export const inviteMember = async (username, email, memberRole) => {
  const response = await api.post('organization/members/', {
    username,
    email,
    member_role: memberRole,
  });
  return response.data;
};

export const updateMemberRole = async (id, memberRole) => {
  const response = await api.patch(`organization/members/${id}/`, {
    member_role: memberRole,
  });
  return response.data;
};

export const removeMember = async (id) => {
  const response = await api.delete(`organization/members/${id}/`);
  return response.data;
};
