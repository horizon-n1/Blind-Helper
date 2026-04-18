import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const getNavigation = async (userSpeech) => {
    const response = await axios.post(`${API_BASE}/api/navigate`, {
        message: userSpeech
    });
    return response.data; // { reply: "...", route: "..." }
};
