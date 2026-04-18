import { useEffect, useRef, useCallback } from 'react';

const useCamera = (onFrame, isGuiding, destination) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const isProcessingRef = useRef(false); // NEW — hard lock

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
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

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (isGuiding && destination) {
            intervalRef.current = setInterval(async () => {
                // Hard skip if still processing last frame
                if (isProcessingRef.current) return;

                const frame = captureFrame();
                if (frame && onFrame) {
                    isProcessingRef.current = true;
                    await onFrame(frame);
                    isProcessingRef.current = false;
                }
            }, 4000); // Bumped to 4s to give more breathing room
        } else {
            clearInterval(intervalRef.current);
            isProcessingRef.current = false;
        }

        return () => clearInterval(intervalRef.current);
    }, [isGuiding, destination]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    }, []);

    return { videoRef, captureFrame };
};

export default useCamera;