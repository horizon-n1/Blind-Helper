import { useEffect, useState, useRef } from 'react';
import { speakText } from '../services/elevenLabsService';
import ObstacleAlert from '../components/ObstacleAlert';
import '../App.css';

const DEMO_STEPS = [
    { id: 1, instruction: 'Turn left 90 degrees.', obstacle: false, delay: 4000 },
    { id: 2, instruction: 'Walk 2 steps forward.', obstacle: false, delay: 4000 },
    { id: 3, instruction: 'Stop. Obstacle detected.', obstacle: true, delay: 4000 },
    { id: 4, instruction: 'Step right 1 step.', obstacle: false, delay: 4000 },
    { id: 5, instruction: 'Continue 2 step forward.', obstacle: false, delay: 4000 },
    { id: 6, instruction: 'You have arrived at the door.', obstacle: false, delay: 0 },
];

const Demo = ({ onExit }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [obstacle, setObstacle] = useState(false);
    const [currentText, setCurrentText] = useState('Press Start to begin the demo.');
    const cancelledRef = useRef(false);

    const runDemo = async () => {
        setIsRunning(true);
        setIsDone(false);
        setCurrentStep(0);
        cancelledRef.current = false;

        for (let i = 0; i < DEMO_STEPS.length; i++) {
            if (cancelledRef.current) break;

            const step = DEMO_STEPS[i];
            setCurrentStep(i + 1);
            setCurrentText(step.instruction);

            if (step.obstacle) {
                setObstacle(true);
                setTimeout(() => setObstacle(false), 3000);
            }

            await speakText(step.instruction);

            if (cancelledRef.current) break;

            if (step.delay > 0) {
                await new Promise(r => setTimeout(r, step.delay));
            }
        }

        if (!cancelledRef.current) {
            setIsDone(true);
            setIsRunning(false);
            setCurrentText('Demo complete.');
        }
    };

    const handleStop = () => {
        cancelledRef.current = true;
        setIsRunning(false);
        setObstacle(false);
        setCurrentText('Demo stopped.');
        setCurrentStep(0);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => { cancelledRef.current = true; };
    }, []);

    return (
        <div className="app-container" style={{ justifyContent: 'flex-start', gap: '1rem' }}>

            {obstacle && <ObstacleAlert source="sensor" />}

            {/* Header */}
            <div className="header">
                <h1>BlindNav</h1>
                <p>Live Demo Mode</p>
            </div>

            {/* Exit button */}
            <button
                onClick={() => { handleStop(); onExit(); }}
                style={{
                    position: 'absolute',
                    top: '1.5rem',
                    right: '1.5rem',
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                }}
            >
                ✕ Exit
            </button>

            {/* Step progress */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
                padding: '0.5rem 0',
            }}>
                {DEMO_STEPS.map((step, i) => (
                    <div
                        key={step.id}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            background: currentStep > i
                                ? (step.obstacle ? 'var(--alert-color)' : 'var(--accent-color)')
                                : 'rgba(255,255,255,0.1)',
                            color: currentStep > i ? 'white' : 'var(--text-secondary)',
                            border: currentStep === i + 1
                                ? '2px solid white'
                                : '2px solid transparent',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {step.obstacle ? '⚠' : i + 1}
                    </div>
                ))}
            </div>

            {/* Current instruction */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5rem',
                textAlign: 'center',
                padding: '1rem',
            }}>
                <div style={{
                    fontSize: currentStep > 0 ? '1.8rem' : '1.2rem',
                    fontWeight: '700',
                    color: obstacle ? 'var(--alert-color)' : 'var(--text-primary)',
                    lineHeight: 1.3,
                    transition: 'all 0.3s ease',
                    fontFamily: 'Outfit, sans-serif',
                }}>
                    {currentText}
                </div>

                {currentStep > 0 && !isDone && (
                    <div style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                    }}>
                        Step {currentStep} of {DEMO_STEPS.length}
                    </div>
                )}

                {isDone && (
                    <div style={{
                        color: '#10b981',
                        fontSize: '1rem',
                        fontWeight: '600',
                    }}>
                        ✓ Navigation successful
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                {!isRunning ? (
                    <button
                        onClick={runDemo}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontFamily: 'Outfit, sans-serif',
                        }}
                    >
                        {isDone ? '↺ Run Again' : '▶ Start Demo'}
                    </button>
                ) : (
                    <button
                        onClick={handleStop}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: 'var(--alert-color)',
                            border: '1px solid var(--alert-color)',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontFamily: 'Outfit, sans-serif',
                        }}
                    >
                        ■ Stop
                    </button>
                )}
            </div>

        </div>
    );
};

export default Demo;