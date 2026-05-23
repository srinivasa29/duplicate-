import api from './api';

export const submitSupportMessage = async (payload) => {
    const response = await api.post('/support/messages', payload);
    return response.data;
};
