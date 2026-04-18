import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const scanRoom = async (base64Image) => {
    const response = await axios.post(`${API_BASE}/api/vision`, {
        image: base64Image
    });
    return response.data; // { description: "There is a chair 3 feet ahead..." }
};
