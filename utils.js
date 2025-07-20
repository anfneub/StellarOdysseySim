// Utility functions translated from Python

function millify(n) {
    if (n < 0) {
        return '-' + millify(-n);
    }
    if (n < 1000) {
        if (Number.isInteger(n)) {
            return String(n);
        } else {
            if (Number.isInteger(n)) {
                return String(parseInt(n));
            } else {
                return n.toFixed(2).replace(/\.00$/, '').replace(/\.(\d)0$/, '.$1');
            }
        }
    } else {
        const millnames = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp'];
        n = parseFloat(n);
        const max_index = millnames.length - 1;
        const thousands = Math.floor(Math.log10(n) / 3);
        const millidx = Math.max(0, Math.min(max_index, thousands));
        let formatted_number = (n / Math.pow(10, 3 * millidx)).toFixed(2);
        if (formatted_number.endsWith('.00')) {
            formatted_number = formatted_number.slice(0, -1);
        }
        return `${formatted_number}${millnames[millidx]}`;
    }
}

function demillify(n) {
    if (typeof n === 'number') {
        return n;
    }
    if (!/[a-zA-Z]/.test(n)) {
        if (n.includes('.')) {
            return parseFloat(n);
        } else {
            return parseInt(n);
        }
    }
    if (n.endsWith('k') || n.endsWith('K')) {
        return parseFloat(n.slice(0, -1)) * 1e3;
    } else if (n.endsWith('m') || n.endsWith('M')) {
        return parseFloat(n.slice(0, -1)) * 1e6;
    } else if (n.endsWith('b') || n.endsWith('B')) {
        return parseFloat(n.slice(0, -1)) * 1e9;
    } else if (n.endsWith('t') || n.endsWith('T')) {
        return parseFloat(n.slice(0, -1)) * 1e12;
    } else if (n.endsWith('qa') || n.endsWith('QA')) {
        return parseFloat(n.slice(0, -2)) * 1e15;
    } else if (n.endsWith('qi') || n.endsWith('QI')) {
        return parseFloat(n.slice(0, -2)) * 1e18;
    } else if (n.endsWith('sx') || n.endsWith('SX')) {
        return parseFloat(n.slice(0, -2)) * 1e21;
    } else if (n.endsWith('sp') || n.endsWith('SP')) {
        return parseFloat(n.slice(0, -2)) * 1e24;
    } else {
        throw new Error(`Number format ${n} not recognized`);
    }
}

function calculateBattleBoost(level) {
    level = Math.max(0, parseInt(level) || 0);
    let boost = 0;

    // boost = level * 0.05;

    if (level <= 10) {
        boost = level * 0.05;
    } else if (level <= 20) {
        boost = 10 * 0.05 + (level - 10) * 0.03;
    } else {
        boost = 10 * 0.05 + 10 * 0.03 + (level - 20) * 0.02;
    }
    return boost;
}

export { millify, demillify, calculateBattleBoost }; 