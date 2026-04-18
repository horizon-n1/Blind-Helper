import { useEffect, useRef, useCallback } from 'react';

const useCamera = (onFrame, isGuiding, destination) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const isProcessingRef = useRef(false);
    const onFrameRef = useRef(onFrame);

    // Keep onFrame ref current so interval always calls latest version
    useEffect(() => {
        onFrameRef.current = onFrame;
    }, [onFrame]);

    // Start camera stream once on mount
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();
                        console.log('Camera ready:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                    };
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
    }, []); // only runs once

    // Control the guidance loop separately
    useEffect(() => {
        if (isGuiding && destination) {
            console.log('Starting camera guidance loop');

            // Clear any existing interval first
            if (intervalRef.current) clearInterval(intervalRef.current);
            isProcessingRef.current = false;

            intervalRef.current = setInterval(async () => {
                if (isProcessingRef.current) {
                    console.log('Skipping frame — still processing');
                    return;
                }

                const frame = captureFrame();
                if (!frame) {
                    console.log('No frame captured');
                    return;
                }

                isProcessingRef.current = true;
                try {
                    await onFrameRef.current(frame);
                } finally {
                    isProcessingRef.current = false;
                }
            }, 5000); // every 5 seconds

        } else {
            console.log('Stopping camera guidance loop');
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            isProcessingRef.current = false;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isGuiding, destination]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) {
            console.log('Video not ready, width:', video?.videoWidth);
            return null;
        }

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