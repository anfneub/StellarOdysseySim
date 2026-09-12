// UI + state for the "System Filters" card on the Universe Map tab.
//
// Filters are a tree: every group has an AND/OR operator and a list of
// children, where each child is either a leaf "condition" (node type +
// quality range) or another nested group. This supports arbitrary
// expressions like:
//   (80-100 icy) AND ( (10-20 rocky) OR (50-70 crystal) )
// which is the root group (operator AND) containing one condition and one
// nested group (operator OR) with two conditions.
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
    constructor(listId, addConditionButtonId, addGroupButtonId, countId, onChange, getSystems) {
        this.listEl = document.getElementById(listId);
        this.addConditionButton = document.getElementById(addConditionButtonId);
        this.addGroupButton = document.getElementById(addGroupButtonId);
        this.countEl = document.getElementById(countId);
        this.onChange = onChange || (() => {});
        this.getSystems = getSystems || (() => []);

        this.root = this.newGroup();

        if (this.addConditionButton) {
            this.addConditionButton.addEventListener('click', () => {
                this.root.children.push(this.newCondition());
                this.render();
                this.notifyChange();
            });
        }
        if (this.addGroupButton) {
            this.addGroupButton.addEventListener('click', () => {
                this.root.children.push(this.newGroup());
                this.render();
                this.notifyChange();
            });
        }

        this.render();
        this.refreshCount();
    }

    newCondition() {
        return {
            type: 'condition',
            nodeType: SYSTEM_FILTER_NODE_TYPES[0].value,
            min: SYSTEM_FILTER_QUALITY_MIN,
            max: SYSTEM_FILTER_QUALITY_MAX
        };
    }

    newGroup() {
        return { type: 'group', operator: 'AND', children: [] };
    }

    // Re-renders/redraws the map and updates the "Found N systems" line -
    // called after any change to the filter tree.
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

    // Public entry point: does this system satisfy the whole filter tree?
    matches(system) {
        return this.evalGroup(this.root, system);
    }

    evalGroup(group, system) {
        if (group.children.length === 0) return true;
        return group.operator === 'AND'
            ? group.children.every((child) => this.evalNode(child, system))
            : group.children.some((child) => this.evalNode(child, system));
    }

    evalNode(node, system) {
        return node.type === 'group' ? this.evalGroup(node, system) : this.conditionMatches(node, system);
    }

    conditionMatches(condition, system) {
        if (!Array.isArray(system.bodies)) return false;
        return system.bodies.some((body) =>
            body.hasNodes &&
            body.nodeType === condition.nodeType &&
            body.nodeQuality >= condition.min &&
            body.nodeQuality <= condition.max
        );
    }

    render() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        this.listEl.appendChild(this.buildGroup(this.root, null, true));
    }

    // Renders a group (root or nested) and recurses into its children.
    // `parentChildren` is the array this group itself lives in, so the
    // group's own remove button can splice itself out (null for the root,
    // which cannot be removed).
    buildGroup(group, parentChildren, isRoot) {
        const box = document.createElement('div');
        box.style.cssText = isRoot
            ? 'display: flex; flex-direction: column; gap: 0.6em;'
            : 'display: flex; flex-direction: column; gap: 0.6em; background: #202537; border: 1px solid #2c3242; border-left: 3px solid #4fa3ff; border-radius: 4px; padding: 0.6em; box-sizing: border-box;';

        if (!isRoot) {
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 0.5em;';
            header.appendChild(this.buildOperatorToggle(group));
            header.appendChild(this.buildRemoveButton(() => {
                const idx = parentChildren.indexOf(group);
                if (idx !== -1) parentChildren.splice(idx, 1);
                this.render();
                this.notifyChange();
            }));
            box.appendChild(header);
        } else if (group.children.length >= 2) {
            box.appendChild(this.buildOperatorToggle(group));
        }

        if (group.children.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: #9aa3b5; font-size: 0.9em;';
            empty.textContent = isRoot ? 'No filters configured yet.' : 'Empty group - add a condition or subgroup.';
            box.appendChild(empty);
        }

        group.children.forEach((child) => {
            box.appendChild(
                child.type === 'group'
                    ? this.buildGroup(child, group.children, false)
                    : this.buildCondition(child, group.children)
            );
        });

        if (!isRoot) {
            const footer = document.createElement('div');
            footer.style.cssText = 'display: flex; gap: 0.5em;';
            footer.appendChild(this.buildSmallButton('+ Condition', () => {
                group.children.push(this.newCondition());
                this.render();
                this.notifyChange();
            }));
            footer.appendChild(this.buildSmallButton('+ Group', () => {
                group.children.push(this.newGroup());
                this.render();
                this.notifyChange();
            }));
            box.appendChild(footer);
        }

        return box;
    }

    buildSmallButton(label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = 'flex: 1; background: #36405a; color: #e6eaf3; border: 1px solid #2c3242; padding: 0.35em 0.6em; border-radius: 4px; cursor: pointer; font-size: 0.85em;';
        btn.addEventListener('click', onClick);
        return btn;
    }

    buildRemoveButton(onClick) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove';
        removeBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 0; background: rgba(255, 82, 82, 0.15); color: #ff8a80; border: 1px solid rgba(255, 82, 82, 0.5); border-radius: 4px; width: 1.54em; height: 1.54em; cursor: pointer; font-size: 1.1em; line-height: 1; flex-shrink: 0; box-sizing: border-box;';
        removeBtn.addEventListener('click', onClick);
        return removeBtn;
    }

    // AND/OR segmented toggle for a group. Only meaningful (and only shown
    // by the caller) once a group has 2+ children to combine.
    buildOperatorToggle(group) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; align-items: center; gap: 0.4em;';
        if (group.children.length < 2) return wrap;

        const label = document.createElement('span');
        label.textContent = 'Combine with:';
        label.style.cssText = 'color: #9aa3b5; font-size: 0.85em;';
        wrap.appendChild(label);

        const buttonStyle = (active) => `background: ${active ? '#4fa3ff' : '#36405a'}; color: ${active ? '#0d1420' : '#e6eaf3'}; border: 1px solid #2c3242; padding: 0.25em 0.7em; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: ${active ? '700' : '400'};`;

        ['AND', 'OR'].forEach((op) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = op;
            btn.style.cssText = buttonStyle(op === group.operator);
            btn.addEventListener('click', () => {
                if (group.operator === op) return;
                group.operator = op;
                wrap.querySelectorAll('button').forEach((b) => {
                    b.style.cssText = buttonStyle(b.textContent === op);
                });
                this.notifyChange();
            });
            wrap.appendChild(btn);
        });

        return wrap;
    }

    // A leaf condition: node type dropdown + quality range slider + remove button.
    buildCondition(condition, parentChildren) {
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
            if (type.value === condition.nodeType) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => {
            condition.nodeType = select.value;
            this.notifyChange();
        });

        const removeBtn = this.buildRemoveButton(() => {
            const idx = parentChildren.indexOf(condition);
            if (idx !== -1) parentChildren.splice(idx, 1);
            this.render();
            this.notifyChange();
        });
        removeBtn.style.position = 'relative';
        removeBtn.style.top = '-8px';

        topRow.appendChild(select);
        topRow.appendChild(removeBtn);

        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display: flex; align-items: center; gap: 0.6em;';

        const numberInputStyle = 'width: 3.6em; background: #36405a; color: #e6eaf3; border: 1px solid #2c3242; border-radius: 4px; padding: 0.2em; box-sizing: border-box;';

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = SYSTEM_FILTER_QUALITY_MIN;
        minInput.max = SYSTEM_FILTER_QUALITY_MAX;
        minInput.value = condition.min;
        minInput.style.cssText = numberInputStyle;

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.min = SYSTEM_FILTER_QUALITY_MIN;
        maxInput.max = SYSTEM_FILTER_QUALITY_MAX;
        maxInput.value = condition.max;
        maxInput.style.cssText = numberInputStyle;

        const slider = this.buildSlider(condition, minInput, maxInput);

        minInput.addEventListener('change', () => {
            let val = clampFilterValue(parseInt(minInput.value, 10) || SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MAX);
            if (val > condition.max) val = condition.max;
            condition.min = val;
            minInput.value = val;
            slider.update();
            this.notifyChange();
        });

        maxInput.addEventListener('change', () => {
            let val = clampFilterValue(parseInt(maxInput.value, 10) || SYSTEM_FILTER_QUALITY_MAX, SYSTEM_FILTER_QUALITY_MIN, SYSTEM_FILTER_QUALITY_MAX);
            if (val < condition.min) val = condition.min;
            condition.max = val;
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
    buildSlider(condition, minInput, maxInput) {
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
            const minPct = valueToPercent(condition.min);
            const maxPct = valueToPercent(condition.max);
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
                    condition.min = Math.min(val, condition.max);
                    minInput.value = condition.min;
                } else {
                    condition.max = Math.max(val, condition.min);
                    maxInput.value = condition.max;
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
        'addSystemGroupBtn',
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
