// UI + state for the "System Filters" card on the Universe Map tab.
// Each row constrains systems to ones that have at least one body of a given
// gathering-node type whose quality falls within [min, max]. Rows combine
// with AND - a system must satisfy every configured row to pass.
const SYSTEM_FILTER_NODE_TYPES = [
    { value: 'icy', label: 'Icy' },
    { value: 'rocky', label: 'Rocky' },
    { value: 'gas', label: 'Gas' },
    { value: 'crystal', label: 'Crystal' }
];

const SYSTEM_FILTER_QUALITY_MIN = 0;
const SYSTEM_FILTER_QUALITY_MAX = 100;
const SYSTEM_FILTER_MIN_THUMB_COLOR = '#4fa3ff';
const SYSTEM_FILTER_MAX_THUMB_COLOR = '#ffa726';

function clampFilterValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

class SystemFiltersUI {
    constructor(listId, addButtonId, countId, onChange, getSystems) {
        this.listEl = document.getElementById(listId);
        this.addButton = document.getElementById(addButtonId);
        this.countEl = document.getElementById(countId);
        this.onChange = onChange || (() => {});
        this.getSystems = getSystems || (() => []);
        this.filters = [];
        this.nextId = 1;

        if (this.addButton) {
            this.addButton.addEventListener('click', () => this.addFilter());
        }
        this.render();
        this.refreshCount();
    }

    // Re-renders/redraws the map and updates the "Found N systems" line -
    // called after any change to the filter rows themselves.
    notifyChange() {
        this.refreshCount();
        this.onChange();
    }

    refreshCount() {
        if (!this.countEl) return;
        const systems = this.getSystems() || [];
        const count = systems.filter((system) => this.matches(system)).length;
        this.countEl.textContent = `Found ${count} systems`;
    }

    addFilter() {
        this.filters.push({
            id: this.nextId++,
            nodeType: SYSTEM_FILTER_NODE_TYPES[0].value,
            min: SYSTEM_FILTER_QUALITY_MIN,
            max: SYSTEM_FILTER_QUALITY_MAX
        });
        this.render();
        this.notifyChange();
    }

    removeFilter(id) {
        this.filters = this.filters.filter((f) => f.id !== id);
        this.render();
        this.notifyChange();
    }

    // A system passes when every configured row matches at least one of its bodies.
    matches(system) {
        if (this.filters.length === 0) return true;
        if (!Array.isArray(system.bodies)) return false;
        return this.filters.every((filter) => system.bodies.some((body) =>
            body.hasNodes &&
            body.nodeType === filter.nodeType &&
            body.nodeQuality >= filter.min &&
            body.nodeQuality <= filter.max
        ));
    }

    render() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (this.filters.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: #9aa3b5; font-size: 0.9em;';
            empty.textContent = 'No filters configured yet.';
            this.listEl.appendChild(empty);
            return;
        }

        this.filters.forEach((filter) => this.listEl.appendChild(this.buildRow(filter)));
    }

    buildRow(filter) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; flex-direction: column; gap: 0.6em; background: #1b1f2b; border: 1px solid #2c3242; border-radius: 4px; padding: 0.6em; box-sizing: border-box;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: center; gap: 0.5em;';

        const select = document.createElement('select');
        select.style.cssText = 'flex: 1; height: 2.2em; background: #36405a; color: #e6eaf3; border: 1px solid #2c3242; padding: 0 0.4em; border-radius: 4px; box-sizing: border-box;';
        SYSTEM_FILTER_NODE_TYPES.forEach((type) => {
            const opt = document.createElement('option');
            opt.value = type.value;
            opt.textContent = type.label;
            if (type.value === filter.nodeType) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => {
            filter.nodeType = select.value;
            this.notifyChange();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove filter';
        removeBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 0; background: rgba(255, 82, 82, 0.15); color: #ff8a80; border: 1px solid rgba(255, 82, 82, 0.5); border-radius: 4px; width: 1.54em; height: 1.54em; cursor: pointer; font-size: 1.1em; line-height: 1; flex-shrink: 0; box-sizing: border-box; position: relative; top: -8px;';
        removeBtn.addEventListener('click', () => this.removeFilter(filter.id));

        topRow.appendChild(select);
        topRow.appendChild(removeBtn);

        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display: flex; align-items: center; gap: 0.6em;';

        const numberInputStyle = 'width: 3.6em; background: #36405a; color: #e6eaf3; border: 1px solid #2c3242; border-radius: 4px; padding: 0.2em; box-sizing: border-box;';

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = SYSTEM_FILTER_QUALITY_MIN;
        minInput.max = SYSTEM_FILTER_QUALITY_MAX;
        minInput.value = filter.min;
        minInput.style.cssText = numberInputStyle;

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.min = SYSTEM_FILTER_QUALITY_MIN;
        maxInput.max = SYSTEM_FILTER_QUALITY_MAX;
        maxInput.value = filter.max;
        maxInput.style.cssText = numberInputStyle;

        const slider = this.buildSlider(filter, minInput, maxInput);

        minInput.addEventListener('change', () => {
            let val = clampFilterValue(parseInt(minInput.value, 10) || SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MAX);
            if (val > filter.max) val = filter.max;
            filter.min = val;
            minInput.value = val;
            slider.update();
            this.notifyChange();
        });

        maxInput.addEventListener('change', () => {
            let val = clampFilterValue(parseInt(maxInput.value, 10) || SYSTEM_FILTER_QUALITY_MAX, SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MAX);
            if (val < filter.min) val = filter.min;
            filter.max = val;
            maxInput.value = val;
            slider.update();
            this.notifyChange();
        });

        bottomRow.appendChild(minInput);
        bottomRow.appendChild(slider.element);
        bottomRow.appendChild(maxInput);

        row.appendChild(topRow);
        row.appendChild(bottomRow);
        return row;
    }

    // Custom dual-handle range slider (0-100). Native <input type="range">
    // only supports a single thumb, so min/max are two draggable divs over a
    // shared track, kept in sync with the min/max number inputs.
    buildSlider(filter, minInput, maxInput) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position: relative; flex: 1; height: 20px;';

        const track = document.createElement('div');
        track.style.cssText = 'position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%); background: #36405a; border-radius: 2px;';

        const range = document.createElement('div');
        range.style.cssText = 'position: absolute; top: 50%; height: 4px; transform: translateY(-50%); background: #4fa3ff; border-radius: 2px;';

        const thumbStyle = (color) => `position: absolute; top: 50%; width: 14px; height: 14px; margin-left: -7px; transform: translateY(-50%); background: ${color}; border: 2px solid #e6eaf3; border-radius: 50%; cursor: pointer; touch-action: none;`;

        const minThumb = document.createElement('div');
        minThumb.style.cssText = thumbStyle(SYSTEM_FILTER_MIN_THUMB_COLOR);
        minThumb.title = 'Minimum quality';

        const maxThumb = document.createElement('div');
        maxThumb.style.cssText = thumbStyle(SYSTEM_FILTER_MAX_THUMB_COLOR);
        maxThumb.title = 'Maximum quality';

        wrap.appendChild(track);
        wrap.appendChild(range);
        wrap.appendChild(minThumb);
        wrap.appendChild(maxThumb);

        const valueToPercent = (v) => ((v - SYSTEM_FILTER_QUALITY_MIN) / (SYSTEM_FILTER_QUALITY_MAX - SYSTEM_FILTER_QUALITY_MIN)) * 100;
        const percentToValue = (pct) => Math.round(SYSTEM_FILTER_QUALITY_MIN + (pct / 100) * (SYSTEM_FILTER_QUALITY_MAX - SYSTEM_FILTER_QUALITY_MIN));

        const update = () => {
            const minPct = valueToPercent(filter.min);
            const maxPct = valueToPercent(filter.max);
            minThumb.style.left = minPct + '%';
            maxThumb.style.left = maxPct + '%';
            range.style.left = minPct + '%';
            range.style.width = Math.max(0, maxPct - minPct) + '%';
        };

        const startDrag = (thumbType) => (downEvent) => {
            downEvent.preventDefault();
            const rect = wrap.getBoundingClientRect();

            const onMove = (moveEvent) => {
                const pct = clampFilterValue(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100);
                const val = percentToValue(pct);

                if (thumbType === 'min') {
                    filter.min = Math.min(val, filter.max);
                    minInput.value = filter.min;
                } else {
                    filter.max = Math.max(val, filter.min);
                    maxInput.value = filter.max;
                }
                update();
            };

            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                this.notifyChange();
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };

        minThumb.addEventListener('pointerdown', startDrag('min'));
        maxThumb.addEventListener('pointerdown', startDrag('max'));

        update();
        return { element: wrap, update };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const getMapInstance = () => (typeof UniverseMap !== 'undefined' ? UniverseMap.getInstance() : null);
    window.systemFiltersUI = new SystemFiltersUI(
        'systemFiltersList',
        'addSystemFilterBtn',
        'systemFiltersCount',
        () => {
            const map = getMapInstance();
            if (map) map.draw();
        },
        () => {
            const map = getMapInstance();
            return map ? map.systems : [];
        }
    );
});
