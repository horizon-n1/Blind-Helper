// client/src/services/layoutService.js

/**
 * Enhanced layout service for BlindNav (Schema v2).
 * Handles storage, retrieval, and sensory enrichment of waypoints.
 */

const LAYOUTS_KEY = 'blindnav_layouts';
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const saveLayout = (buildingName, data) => {
    const layouts = JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}');
    layouts[buildingName] = {
        ...data,
        schemaVersion: 2,
        savedAt: Date.now(),
    };
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
};

export const loadLayouts = () => {
    return JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}');
};

export const loadLayout = (buildingName) => {
    return loadLayouts()[buildingName] ?? null;
};

export const deleteLayout = (buildingName) => {
    const layouts = loadLayouts();
    delete layouts[buildingName];
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
};

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the backend to add sensory details (floor type, sounds, landmarks) 
 * to a base waypoint graph.
 */
export const enrichLayout = async (baseLayout) => {
    try {
        const response = await fetch(`${API_BASE}/api/vision/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                waypoints: baseLayout.waypoints,
                summary: baseLayout.summary,
                rooms: baseLayout.rooms,
            }),
        });

        if (!response.ok) {
            console.warn('[layout] enrichment failed — saving base layout without cues');
            return baseLayout;
        }

        const { enrichedWaypoints } = await response.json();

        return {
            ...baseLayout,
            waypoints: enrichedWaypoints,
            schemaVersion: 2,
        };
    } catch (err) {
        console.error('[layout] enrichment error:', err);
        return baseLayout; // Graceful fallback
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WAYPOINT ACCESSORS (For use in /guide prompt building)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the spoken arrival announcement for a waypoint.
 */
export const getArrivalText = (waypoint) => {
    return waypoint?.description ?? `You have reached ${waypoint?.name ?? 'your waypoint'}.`;
};

/**
 * Returns a human-readable string of entry cues for the AI navigator.
 */
export const describeEntryCues = (waypoint) => {
    const cues = waypoint?.entryCues;
    if (!cues) return null;

    const parts = [];
    if (cues.floor) parts.push(`${cues.floor} floor`);
    if (cues.stepChange) parts.push('step up or down');
    if (cues.doorPresent) parts.push(`door on your ${cues.doorSide ?? 'side'}`);
    if (cues.touch) parts.push(cues.touch);
    if (cues.sound) parts.push(cues.sound);
    if (cues.smell) parts.push(`smell of ${cues.smell}`);
    if (cues.airflow) parts.push(cues.airflow);

    return parts.length > 0
        ? `Expect: ${parts.join(', ')}.`
        : null;
};

/**
 * Returns the custom verbal label for a specific exit path.
 */
export const getExitLabel = (waypoint, targetId) => {
    return waypoint?.exitLabels?.[targetId] ?? null;
};