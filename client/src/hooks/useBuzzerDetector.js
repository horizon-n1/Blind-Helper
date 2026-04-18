import { useEffect, useRef, useCallback } from 'react';

const TARGET_FREQ = 1047;
const FREQ_TOLERANCE = 15;
const DETECTION_THRESHOLD = 100;
const CONFIRM_COUNT = 4;
const COOLDOWN_MS = 4000;
const DOMINANCE_RATIO = 3.5;  // raised — real buzzer is 5-200x, false positives are 1.8-2.1x
const MAX_NEIGHBOR_AMP = 35;   // NEW — if neighbors are louder than this it's background noise

const useBuzzerDetector = (onDetected, isActive) => {
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const micStreamRef = useRef(null);
    const animFrameRef = useRef(null);
    const confirmCounterRef = useRef(0);
    const lastDetectionRef = useRef(0);

    const startListening = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            micStreamRef.current = stream;

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096; // doubled for much better frequency resolution
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const binHz = audioContext.sampleRate / analyser.fftSize;

            const targetBin = Math.round(TARGET_FREQ / binHz);
            const toleranceBins = Math.round(FREQ_TOLERANCE / binHz);

            // Neighbor bins — 200Hz away on each side
            // Used to check the spike is sharp, not broad noise
            const neighborOffset = Math.round(200 / binHz);

            console.log(`[buzzer] Listening for ${TARGET_FREQ}Hz (bin ${targetBin})`);

            const detect = () => {
                animFrameRef.current = requestAnimationFrame(detect);
                analyser.getByteFrequencyData(dataArray);

                // Peak amplitude at target frequency
                let peakAmplitude = 0;
                for (let i = targetBin - toleranceBins; i <= targetBin + toleranceBins; i++) {
                    if (i >= 0 && i < bufferLength) {
                        peakAmplitude = Math.max(peakAmplitude, dataArray[i]);
                    }
                }

                // Average amplitude of neighboring frequencies (background noise level)
                const leftNeighbor = dataArray[Math.max(0, targetBin - neighborOffset)] || 0;
                const rightNeighbor = dataArray[Math.min(bufferLength - 1, targetBin + neighborOffset)] || 0;
                const neighborAvg = (leftNeighbor + rightNeighbor) / 2;

                // Dominance check — is 1047Hz a sharp spike or just background?
                const isDominant =
                    (neighborAvg === 0 || (peakAmplitude / neighborAvg) >= DOMINANCE_RATIO) &&
                    neighborAvg <= MAX_NEIGHBOR_AMP; // reject if background noise floor is too high

                if (peakAmplitude > DETECTION_THRESHOLD && isDominant) {
                    confirmCounterRef.current += 1;
                    console.log(
                        `[buzzer] Signal: amp=${peakAmplitude} neighbors=${neighborAvg.toFixed(0)} ` +
                        `ratio=${(peakAmplitude / (neighborAvg || 1)).toFixed(2)} ` +
                        `confirm=${confirmCounterRef.current}/${CONFIRM_COUNT}`
                    );

                    if (confirmCounterRef.current >= CONFIRM_COUNT) {
                        const now = Date.now();
                        if (now - lastDetectionRef.current > COOLDOWN_MS) {
                            lastDetectionRef.current = now;
                            confirmCounterRef.current = 0;
                            console.log('[buzzer] OBSTACLE CONFIRMED');
                            onDetected();
                        }
                    }
                } else {
                    // Reset counter on any frame that doesn't qualify
                    if (confirmCounterRef.current > 0) {
                        console.log(`[buzzer] Signal lost — resetting counter (was ${confirmCounterRef.current})`);
                    }
                    confirmCounterRef.current = 0;
                }
            };

            detect();

        } catch (err) {
            console.error('[buzzer] Mic access error:', err);
        }
    }, [onDetected]);

    const stopListening = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) audioContextRef.current.close();
        confirmCounterRef.current = 0;
    }, []);

    useEffect(() => {
        if (isActive) {
            startListening();
        } else {
            stopListening();
        }
        return () => stopListening();
    }, [isActive, startListening, stopListening]);
};

export default useBuzzerDetector;