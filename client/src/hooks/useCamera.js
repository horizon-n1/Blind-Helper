import { useEffect, useRef, useCallback } from 'react';

const useCamera = () => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    // Start the camera stream when the hook mounts
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' } // Use back camera on phone
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Camera access denied:', err);
            }
        };

        startCamera();

        // Cleanup: stop the stream when component unmounts
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Capture a single frame and return it as base64 JPEG
    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video) return null;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Returns base64 string without the data:image/jpeg;base64, prefix
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        return base64;
    }, []);

    return { videoRef, captureFrame };
};

export default useCamera;