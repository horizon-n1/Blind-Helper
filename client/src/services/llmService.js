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
export const navigateToRoom = async (destination, rooms, summary, waypoints) => {
    const response = await axios.post(`${API_BASE}/api/navigate/to-room`, {
        destination,
        rooms,
        summary,
        waypoints
    });
    return response.data;
};

// Check if user is still on track
export const checkProgress = async (image, destination, path, stepIndex, summary) => {
    const response = await axios.post(`${API_BASE}/api/navigate/check-progress`, {
        image,
        destination,
        path,
        stepIndex,
        summary
    });
    return response.data;
};