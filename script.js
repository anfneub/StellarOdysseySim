// Resources Calculator
document.addEventListener('DOMContentLoaded', function() {
    // Load saved values from localStorage
    const savedValues = JSON.parse(localStorage.getItem('resourcesCalculatorValues')) || {};
    const fields = [
        'resources_per_action',
        'rare_resources_per_action',
        'number_of_drones',
        'dodge_percentage',
        'rare_drop_increase',
        'maneuverability'
    ];

    // Apply saved values to fields
    fields.forEach(field => {
        const input = document.getElementById(field);
        if (input && savedValues[field] !== undefined) {
            input.value = savedValues[field];
        }
    });

    // Save values to localStorage when they change
    fields.forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('change', () => {
                const currentValues = JSON.parse(localStorage.getItem('resourcesCalculatorValues')) || {};
                currentValues[field] = input.value;
                localStorage.setItem('resourcesCalculatorValues', JSON.stringify(currentValues));
            });
        }
    });
});

document.getElementById('calculateResourcesBtn').addEventListener('click', function() {
    const resourcesPerAction = parseFloat(document.getElementById('resources_per_action').value) || 0;
    const rareResourcesPerAction = parseFloat(document.getElementById('rare_resources_per_action').value) || 0;
    const numberOfDrones = parseInt(document.getElementById('number_of_drones').value) || 1;
    const dodgePercentage = parseFloat(document.getElementById('dodge_percentage').value)/100.0 || 0;
    const rareDropIncrease = parseFloat(document.getElementById('rare_drop_increase').value)/100.0 || 0;
    const maneuverability = parseFloat(document.getElementById('maneuverability').value)/100.0|| 0;

    // Calculate total dodge
    const totalDodge = 0.5 + dodgePercentage + maneuverability / 2;
    const actionTime = 12;  // seconds

    // Calculate resources per hour
    const resourcesPerHour = resourcesPerAction * numberOfDrones * totalDodge * (0.98 - rareDropIncrease) * 3600 / actionTime;
    
    // Calculate rare resources per hour
    const rareResourcesPerHour = rareResourcesPerAction * numberOfDrones * totalDodge * (0.02 + rareDropIncrease) * 3600 / actionTime;

    // Calculate time to reach goals
    const hoursTo32M = 32000000 / resourcesPerHour;
    const hoursTo800k = 800000 / rareResourcesPerHour;
    const hoursTo1B = 1000000000 / resourcesPerHour;
    const hoursTo1MRare = 1000000 / rareResourcesPerHour;

    // Update results
    document.getElementById('resources_per_hour').textContent = formatNumber(resourcesPerHour) + '/h';
    document.getElementById('rare_resources_per_hour').textContent = formatNumber(rareResourcesPerHour) + '/h';
    document.getElementById('hours_to_32m').textContent = formatNumber(hoursTo32M) + ' h';
    document.getElementById('hours_to_800k').textContent = formatNumber(hoursTo800k) + ' h';
    document.getElementById('time_to_1b').textContent = formatDuration(hoursTo1B);
    document.getElementById('time_to_1m_rare').textContent = formatDuration(hoursTo1MRare);
});

// Format a duration given in hours as "Xd Yh" (or "Yh Zm" when under a day)
function formatDuration(hours) {
    if (isNaN(hours) || !isFinite(hours)) return '-';
    const totalMinutes = Math.round(hours * 60);
    const days = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    if (days > 0) return `${days}d ${h}h (${formatNumber(hours)} h)`;
    return `${h}h ${m}m`;
}

// Add event listeners for input field step buttons (up/down arrows)
document.querySelectorAll('.optimizer-block input[type="number"]').forEach(input => {
    input.addEventListener('input', () => {
        const val = parseFloat(input.value) || 0;
        const min = parseFloat(input.getAttribute('min')) || 0;
        const max = parseFloat(input.getAttribute('max')) || Infinity;
        
        // Ensure value stays within bounds
        if (val < min) input.value = min;
        if (val > max) input.value = max;
    });

    // Also save on input for immediate feedback
    input.addEventListener('input', () => {
        const currentValues = JSON.parse(localStorage.getItem('resourcesCalculatorValues')) || {};
        currentValues[input.id] = input.value;
        localStorage.setItem('resourcesCalculatorValues', JSON.stringify(currentValues));
    });
});

function formatNumber(num) {
    if (isNaN(num) || !isFinite(num)) return '-';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
} 