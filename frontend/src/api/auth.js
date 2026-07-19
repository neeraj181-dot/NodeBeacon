import api from './api';

export const login = async (username, password) => {
  const response = await api.post('auth/login/', { username, password });
  return response.data;
};

export const register = async (username, email, password, firstName = '', lastName = '') => {
  const response = await api.post('auth/register/', {
    username,
    email,
    password,
    first_name: firstName,
    last_name: lastName,
  });
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('auth/profile/');
  return response.data;
};
