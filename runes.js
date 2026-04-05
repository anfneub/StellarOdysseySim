// Runes Path Optimizer logic
document.addEventListener('DOMContentLoaded', function () {
    const findPathBtn = document.getElementById('runesFindPathBtn');
    const outputDiv = document.getElementById('runesOutput');
    const progressContainer = document.getElementById('runesPathProgress');
    const progressBar = document.getElementById('runesPathProgressBar');
    const progressText = document.getElementById('runesPathProgressText');
    
    // Timer formatting
    const timerMins = document.getElementById('runesTimerMinutes');
    const timerSecs = document.getElementById('runesTimerSeconds');
    const timerNotifCheckbox = document.getElementById('runesTimerNotification');

    const saveTimerState = () => {
        if (timerMins) localStorage.setItem('runesTimerMinutes', timerMins.value);
        if (timerSecs) localStorage.setItem('runesTimerSeconds', timerSecs.value);
        if (timerNotifCheckbox) localStorage.setItem('runesTimerNotification', timerNotifCheckbox.checked);
    };

    if (timerMins && localStorage.getItem('runesTimerMinutes')) {
        timerMins.value = localStorage.getItem('runesTimerMinutes');
    }
    if (timerSecs && localStorage.getItem('runesTimerSeconds')) {
        timerSecs.value = localStorage.getItem('runesTimerSeconds');
    }
    if (timerNotifCheckbox && localStorage.getItem('runesTimerNotification')) {
        timerNotifCheckbox.checked = localStorage.getItem('runesTimerNotification') === 'true';
    }

    const formatTimerInput = (input, max) => {
        let val = parseInt(input.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > max) val = max;
        input.value = val.toString().padStart(2, '0');
        saveTimerState();
    };

    if (timerMins) {
        timerMins.addEventListener('blur', () => formatTimerInput(timerMins, 99));
        timerMins.addEventListener('change', () => formatTimerInput(timerMins, 99));
    }
    if (timerSecs) {
        timerSecs.addEventListener('blur', () => formatTimerInput(timerSecs, 59));
        timerSecs.addEventListener('change', () => formatTimerInput(timerSecs, 59));
    }

    if (timerNotifCheckbox) {
        timerNotifCheckbox.addEventListener('change', (e) => {
            saveTimerState();
            if (e.target.checked && "Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        });
    }

    let runesActiveTimerInterval = null;
    const activeTimerDisplay = document.getElementById('runesActiveTimerDisplay');

    if (activeTimerDisplay) {
        const initMins = parseInt(timerMins?.value || 5).toString().padStart(2, '0');
        const initSecs = parseInt(timerSecs?.value || 0).toString().padStart(2, '0');
        activeTimerDisplay.textContent = `${initMins}:${initSecs}`;
    }

    const startRunesTimer = () => {
        if (!activeTimerDisplay) return;
        
        const m = parseInt(timerMins?.value) || 0;
        const s = parseInt(timerSecs?.value) || 0;
        let totalSeconds = m * 60 + s;

        if (totalSeconds <= 0) return;

        clearInterval(runesActiveTimerInterval);
        
        const updateDisplay = () => {
            const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const secs = (totalSeconds % 60).toString().padStart(2, '0');
            activeTimerDisplay.textContent = `${mins}:${secs}`;
        };

        updateDisplay();

        runesActiveTimerInterval = setInterval(() => {
            totalSeconds--;
            if (totalSeconds <= 0) {
                clearInterval(runesActiveTimerInterval);
                activeTimerDisplay.textContent = "00:00";
                
                if (timerNotifCheckbox && timerNotifCheckbox.checked) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Timer has expired", { body: "The runes active timer has finished counting down." });
                    } else {
                        alert("Timer has expired.");
                    }
                }
            } else {
                updateDisplay();
            }
        }, 1000);
    };

    const updateProgress = (pct) => {
        const p = Math.min(100, Math.max(0, pct));
        if (progressBar) progressBar.style.width = p + '%';
        if (progressText) progressText.textContent = Math.floor(p) + '%';
    };

    if (findPathBtn && outputDiv) {
        findPathBtn.addEventListener('click', async function () {
            // Try to get API key from inputs or localStorage
            let apiKey = localStorage.getItem('systems_api_key') || localStorage.getItem('api_key');
            const systemsApiKeyInput = document.getElementById('systems_api_key');
            if (systemsApiKeyInput && systemsApiKeyInput.value) {
                apiKey = systemsApiKeyInput.value;
            }

            if (!apiKey) {
                outputDiv.textContent = 'Error: Please enter your API Key in the Universe Map or Battling tab first.';
                return;
            }

            findPathBtn.disabled = true;
            outputDiv.textContent = '';
            if (progressContainer) progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                let systemsData = null;
                let journalData = null;
                let userData = null;

                updateProgress(5);
                // Check if data is already loaded in UniverseMap or local cache
                window.runesDataCache = window.runesDataCache || { systems: null, journal: null, user: null };
                const map = window.UniverseMap && window.UniverseMap.getInstance ? window.UniverseMap.getInstance() : null;

                // System Data
                if (window.runesDataCache.systems) {
                    systemsData = window.runesDataCache.systems;
                    updateProgress(35);
                } else if (map && map.systems && map.systems.length > 0) {
                    systemsData = map.systems;
                    window.runesDataCache.systems = systemsData;
                    updateProgress(35);
                } else {
                    const sysRes = await fetch('https://api.stellarodyssey.app/api/public/systems', {
                        headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                    });
                    if (!sysRes.ok) throw new Error(`Systems API error: ${sysRes.status}`);
                    systemsData = await sysRes.json();
                    window.runesDataCache.systems = systemsData;
                    updateProgress(35);
                }

                // Always refresh journal Data
                const jourRes = await fetch('https://api.stellarodyssey.app/api/public/journal', {
                    headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                });
                if (!jourRes.ok) throw new Error(`Journal API error: ${jourRes.status}`);
                journalData = await jourRes.json();
                window.runesDataCache.journal = journalData;
                updateProgress(65);
                
                // Always refresh user Data
                const userRes = await fetch('https://api.stellarodyssey.app/api/public/user', {
                    headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                });
                if (!userRes.ok) throw new Error(`User API error: ${userRes.status}`);
                userData = await userRes.json();
                window.runesDataCache.user = userData;
                updateProgress(85);
                
                // Ensure we have user's current coordinates
                const userSystem = userData?.data?.currentSystem;
                if (!userSystem) {
                    throw new Error("Could not determine user's current position from API.");
                }

                const userX = userSystem.coordinate_x;
                const userY = userSystem.coordinate_y;

                // Get checked star types from the UI
                const allowedTypes = [];
                if (document.getElementById('runesFilterRingedDwarf').checked) allowedTypes.push('Ringed Dwarf');
                if (document.getElementById('runesFilterBinaryStars').checked) allowedTypes.push('Binary Stars');
                if (document.getElementById('runesFilterBlackHole').checked) allowedTypes.push('Black Hole');
                if (document.getElementById('runesFilterNeutronStar').checked) allowedTypes.push('Neutron Star');

                // Normalize systems array
                const systemsArray = Array.isArray(systemsData) ? systemsData : (systemsData.systems || []);

                // Extract user's visited coordinates to filter out
                const visitedCoords = new Set();
                if (journalData && journalData.fullJournal) {
                    journalData.fullJournal.forEach(entry => {
                        visitedCoords.add(`${entry.coordinate_x},${entry.coordinate_y}`);
                    });
                }

                // Iteratively expand our search zone until we find at least 10 systems, maxing out at a 51x51 square
                let targetSystems = [];
                const searchRadii = [10, 20, 30, 50]; // Represents side lengths 21, 41, 61, 101

                for (let radius of searchRadii) {
                    targetSystems = systemsArray.filter(sys => {
                        // Check if within square (distance <= radius on both axis)
                        if (Math.abs(sys.coordinate_x - userX) <= radius && Math.abs(sys.coordinate_y - userY) <= radius) {
                            // Check if type matches the checkboxes
                            if (allowedTypes.includes(sys.star)) {
                                // Make sure it hasn't been visited by the player
                                if (!visitedCoords.has(`${sys.coordinate_x},${sys.coordinate_y}`)) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });

                    if (targetSystems.length >= 15) {
                        break;
                    }
                }

                updateProgress(100);

                outputDiv.textContent += `\nFound ${targetSystems.length} matching special stars.\n`;

                if (targetSystems.length > 0) {
                    // 1. Nearest Neighbor
                    let unvisited = [...targetSystems];
                    let currentPos = { coordinate_x: userX, coordinate_y: userY };
                    let path = [];

                    const dist = (a, b) => Math.hypot(a.coordinate_x - b.coordinate_x, a.coordinate_y - b.coordinate_y);

                    while (unvisited.length > 0) {
                        let minDist = Infinity;
                        let bestIdx = -1;
                        for (let i = 0; i < unvisited.length; i++) {
                            let d = dist(currentPos, unvisited[i]);
                            if (d < minDist) {
                                minDist = d;
                                bestIdx = i;
                            }
                        }
                        currentPos = unvisited[bestIdx];
                        path.push(currentPos);
                        unvisited.splice(bestIdx, 1);
                    }

                    // 2. 2-Opt Optimization
                    let route = [{ coordinate_x: userX, coordinate_y: userY, name: 'Current Location', star: 'N/A' }, ...path];
                    let improved = true;
                    while (improved) {
                        improved = false;
                        for (let i = 1; i < route.length - 1; i++) {
                            for (let j = i + 1; j < route.length; j++) {
                                let E1 = dist(route[i - 1], route[i]);
                                let E2 = (j < route.length - 1) ? dist(route[j], route[j + 1]) : 0;
                                let N1 = dist(route[i - 1], route[j]);
                                let N2 = (j < route.length - 1) ? dist(route[i], route[j + 1]) : 0;

                                // Swap if the new edges are shorter than the old edges
                                if (N1 + N2 < E1 + E2 - 0.00001) {
                                    let sub = route.slice(i, j + 1).reverse();
                                    route.splice(i, sub.length, ...sub);
                                    improved = true;
                                }
                            }
                        }
                    }

                    // 3. Print resulting optimal path
                    outputDiv.innerHTML = '';

                    let header = document.createElement('div');
                    header.textContent = '--- Optimal Route ---\n\n';
                    outputDiv.appendChild(header);

                    let totalDistance = 0;
                    // Start from 1 because 0 is the user's starting location
                    // Restrict to max 15 systems
                    const maxSystems = Math.min(route.length, 16);

                    for (let i = 1; i < maxSystems; i++) {
                        let d = dist(route[i - 1], route[i]) * 10.0;
                        totalDistance += d;

                        let rowContainer = document.createElement('div');
                        rowContainer.style.display = 'flex';
                        rowContainer.style.alignItems = 'center';
                        rowContainer.style.marginBottom = '0.5em';

                        let checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.style.margin = '0 1em 0 0';
                        checkbox.style.cursor = 'pointer';

                        let textSpan = document.createElement('span');
                        textSpan.textContent = `${i}. Jump to ${route[i].name} (${route[i].star}) [${route[i].coordinate_x}, ${route[i].coordinate_y}] - Dist: ${d.toFixed(2)} ly`;
                        textSpan.style.transition = 'color 0.2s, text-decoration 0.2s';
                        textSpan.style.cursor = 'pointer';

                        const toggleVisit = () => {
                            if (checkbox.checked) {
                                textSpan.style.textDecoration = 'line-through';
                                textSpan.style.color = '#888888';
                            } else {
                                textSpan.style.textDecoration = 'none';
                                textSpan.style.color = '#ffffff';
                            }
                            startRunesTimer();
                        };

                        checkbox.addEventListener('change', toggleVisit);
                        textSpan.addEventListener('click', () => {
                            checkbox.checked = !checkbox.checked;
                            toggleVisit();
                        });

                        rowContainer.appendChild(checkbox);
                        rowContainer.appendChild(textSpan);
                        outputDiv.appendChild(rowContainer);
                    }

                    let footer = document.createElement('div');
                    footer.textContent = `\nTotal estimated travel distance: ${totalDistance.toFixed(2)} ly`;
                    footer.style.marginTop = '1em';
                    outputDiv.appendChild(footer);

                } else {
                    outputDiv.textContent += 'No suitable target stars found nearby that match your criteria.\n';
                }

            } catch (error) {
                outputDiv.textContent += `\nError: ${error.message}`;
            } finally {
                findPathBtn.disabled = false;
            }
        });
    }
});
