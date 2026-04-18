const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Scan video — get room map + waypoint graph
export const scanVideo = async (videoFile) => {
    const formData = new FormData();
    formData.append('video', videoFile);

    const response = await fetch(`${API_BASE}/api/vision/scan`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('Video scan failed');
    return response.json();
};

// Get real-time guidance step
export const getGuidanceStep = async (image, destination, rooms, summary, lastInstruction) => {
    const response = await fetch(`${API_BASE}/api/navigate/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, destination, rooms, summary, lastInstruction })
    });

    if (!response.ok) throw new Error('Guidance failed');
    return response.json();
};