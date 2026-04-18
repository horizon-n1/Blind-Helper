import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// General voice command
export const getNavigation = async (userSpeech) => {
    const response = await axios.post(`${API_BASE}/api/navigate`, {
        message: userSpeech
    });
    return response.data;
};

// Navigate to a specific room using the scanned map
export const navigateToRoom = async (destination, rooms, summary) => {
    const response = await axios.post(`${API_BASE}/api/navigate/to-room`, {
        destination,
        rooms,
        summary
    });
    return response.data;
};