const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Stage 1 — upload video, get rooms back
export const scanVideo = async (videoFile) => {
    const formData = new FormData();
    formData.append('video', videoFile);

    const response = await fetch(`${API_BASE}/api/vision/scan`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('Video scan failed');
    return response.json(); // { rooms: [...], summary: "..." }
};

// Stage 2 — get initial directions
export const navigateToRoom = async (destination, rooms, summary) => {
    const response = await fetch(`${API_BASE}/api/vision/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, rooms, summary })
    });

    if (!response.ok) throw new Error('Navigation failed');
    return response.json(); // { directions: "..." }
};

// Stage 3 — real-time guidance from camera frame
export const getGuidanceStep = async (image, destination, rooms, summary) => {
    const response = await fetch(`${API_BASE}/api/vision/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, destination, rooms, summary })
    });

    if (!response.ok) throw new Error('Guidance failed');
    return response.json(); // { instruction: "Turn left", arrived: false }
};