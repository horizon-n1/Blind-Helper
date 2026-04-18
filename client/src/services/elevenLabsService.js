const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const speakText = async (text) => {
    const response = await fetch(`${API_BASE}/api/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    // Stream the audio back and play it
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();

    return audio;
};
