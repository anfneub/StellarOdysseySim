class UniverseMap {
    static instance = null;
    static getInstance() {
        return UniverseMap.instance;
    }
    constructor(canvasId) {
        UniverseMap.instance = this;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.systems = [];
        this.hoveredSystem = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.zoomLevel = 1;
        this.zoomCenterX = 0;
        this.zoomCenterY = 0;
        this.playerPosition = null;
        this.pulseAnimation = null;
        this.pulsePhase = 0;
        this.ripples = [];
        this.journalData = null;
        this.hoveredJourneyPoint = null;
        this.hoveredSpaceStation = null; // Added for squadron space stations
        this.visible = this.getVisibleRange();
                
        // Touch support variables
        this.touchStartDistance = 0;
        this.touchStartZoomLevel = 1;
        this.touchStartOffsetX = 0;
        this.touchStartOffsetY = 0;
        this.touchStartCenterX = 0;
        this.touchStartCenterY = 0;
        this.isPinching = false;
        this.lastTouchTime = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        
        // Load checkbox states from localStorage
        this.showPublicSystems = localStorage.getItem('showPublicSystems') === 'true';
        this.showCurrentPosition = localStorage.getItem('showCurrentPosition') === 'true';
        this.showPlayerJourney = localStorage.getItem('showPlayerJourney') === 'true';
        this.showSpaceStations = localStorage.getItem('showSpaceStations') === 'true';
        this.squadronSpaceStations = [];
        
        // Space station coordinates (hardcoded)
        // this.spaceStations = [];
        
        // Set initial checkbox states
        document.getElementById('show_public_systems').checked = this.showPublicSystems;
        document.getElementById('show_current_position').checked = this.showCurrentPosition;
        document.getElementById('show_player_journey').checked = this.showPlayerJourney;
        document.getElementById('show_space_stations').checked = this.showSpaceStations;

        // Add checkbox event listeners
        document.getElementById('show_public_systems').addEventListener('change', (e) => {
            this.showPublicSystems = e.target.checked;
            localStorage.setItem('showPublicSystems', this.showPublicSystems);
            this.draw();
        });
        
        document.getElementById('show_current_position').addEventListener('change', (e) => {
            this.showCurrentPosition = e.target.checked;
            localStorage.setItem('showCurrentPosition', this.showCurrentPosition);
            if (this.showCurrentPosition && this.playerPosition) {
                this.startPulseAnimation();
            } else {
                if (this.pulseAnimation) {
                    cancelAnimationFrame(this.pulseAnimation);
                    this.pulseAnimation = null;
                }
                this.ripples = [];
                this.draw();
            }
        });

        document.getElementById('show_player_journey').addEventListener('change', (e) => {
            this.showPlayerJourney = e.target.checked;
            localStorage.setItem('showPlayerJourney', this.showPlayerJourney);
            this.draw();
        });

        document.getElementById('show_space_stations').addEventListener('change', (e) => {
            this.showSpaceStations = e.target.checked;
            localStorage.setItem('showSpaceStations', this.showSpaceStations);
            this.draw();
        });

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Add event listeners
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Add touch event listeners for mobile support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

        this.paused = false;
        this.colorCache = new Map(); // Cache for journey point colors
        this._lastDrawTime = 0;      // For throttling draw calls
        this._drawQueued = false;    // For throttling draw calls
    }

    getVisibleRange() {
        const padding = { left: 40, right: 140, top: 25, bottom: 25 };
        const graphWidth = this.canvas.width - padding.left - padding.right;
        const graphHeight = this.canvas.height - padding.top - padding.bottom;
        const visibleWidth = 2000 / this.zoomLevel;
        const visibleHeight = 2000 / this.zoomLevel;
        const left = this.offsetX;
        const top = this.offsetY;
        const right = left + visibleWidth;
        const bottom = top + visibleHeight;
        return { left, right, top, bottom };
    }

    resizeCanvas() {
        // Make canvas responsive while maintaining aspect ratio
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Check if we're on mobile (container width is the limiting factor)
        const isMobile = containerWidth < 768;
        
        if (isMobile) {
            // On mobile, use the smaller dimension to ensure square aspect ratio
            const size = Math.min(containerWidth, containerHeight, window.innerHeight * 0.7);
            this.canvas.width = size;
            this.canvas.height = size;
            
            // Set CSS to maintain square aspect ratio
            this.canvas.style.width = `${size}px`;
            this.canvas.style.height = `${size}px`;
        } else {
            // Desktop behavior - use the height as base and make width 15% larger (+5% more)
            const height = Math.min(containerWidth / 1.18, containerHeight) * 1.18;
            const width = height * 1.18;
            
            // Set width and height
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Ensure the canvas maintains its shape
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        }
        
        this.draw();
    }

    loadSystems(data) {
        this.systems = data.systems;
        // Update the systems count text
        const systemsCountElement = document.getElementById('systemsCount');
        if (systemsCountElement) {
            systemsCountElement.textContent = `There are currently ${this.systems.length} publicly discovered systems`;
        }
        this.draw();
    }

    setPlayerPosition(position) {
        this.playerPosition = position;
        if (this.pulseAnimation) {
            cancelAnimationFrame(this.pulseAnimation);
        }
        this.ripples = [];
        this.startPulseAnimation();
    }

    setJournalData(journalData) {
        this.journalData = journalData;
        this.colorCache = new Map(); // Clear color cache when journal changes
        // Calculate and display total distance traveled
        const distanceElement = document.getElementById('totalDistance');
        if (distanceElement && this.journalData && this.journalData.fullJournal.length > 0) {
            let totalDistance = 0;
            const journal = this.journalData.fullJournal;
            
            // Calculate distance between consecutive non-starter systems
            for (let i = 1; i < journal.length; i++) {
                const prev = journal[i-1];
                const curr = journal[i];
                
                // Only add distance if neither system is a starter
                if (!prev.starter && !curr.starter) {
                    const dx = curr.coordinate_x - prev.coordinate_x;
                    const dy = curr.coordinate_y - prev.coordinate_y;
                    totalDistance += 10 * Math.sqrt(dx * dx + dy * dy);
                }
            }
            
            distanceElement.textContent = `You currently have travelled ${totalDistance.toFixed(2)} ly`;
        } else if (distanceElement) {
            distanceElement.textContent = 'You currently have travelled 0 ly';
        }
        this.draw();
    }

    pause() {
        this.paused = true;
        if (this.pulseAnimation) {
            cancelAnimationFrame(this.pulseAnimation);
            this.pulseAnimation = null;
        }
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        if (this.showCurrentPosition && this.playerPosition) {
            this.startPulseAnimation();
        } else {
            this.draw();
        }
    }

    startPulseAnimation() {
        if (this.paused) return;
        let lastFrameTime = 0;
        const FRAME_INTERVAL = 50; // ms, for 20fps
        const animate = (now) => {
            if (this.paused) return;
            if (!lastFrameTime || now - lastFrameTime >= FRAME_INTERVAL) {
                lastFrameTime = now;
                // Add new ripple every 0.3 seconds (was 0.2)
                if (this.pulsePhase % (Math.PI * 2) < 0.1) {
                    this.ripples.push({
                        size: 5, // Start with a small circle
                        opacity: 1,
                        startTime: Date.now()
                    });
                }
                this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2); // Slower phase change for less frequent ripples

                // Update existing ripples
                const currentTime = Date.now();
                this.ripples = this.ripples.filter(ripple => {
                    const age = currentTime - ripple.startTime;
                    const progress = age / 750; // 750ms = 0.75 seconds for full animation (was 500ms)
                    if (progress >= 1) return false; // Remove after 0.75 seconds
                    ripple.size = 5 + (progress * 25); // Expand from 5 to 30
                    ripple.opacity = 1 - progress; // Fade out linearly
                    return true;
                });
                this.draw();
            }
            this.pulseAnimation = requestAnimationFrame(animate);
        };
        this.pulseAnimation = requestAnimationFrame(animate);
    }

    // Helper function to get color based on date
    getColorFromDate(date) {
        if (!date) return '#FF5252';
        if (this.colorCache.has(date)) {
            return this.colorCache.get(date);
        }
        
        // Convert date string to timestamp
        const timestamp = new Date(date).getTime();
        
        // Get min and max timestamps from journal data
        const timestamps = this.journalData.fullJournal.map(entry => new Date(entry.date).getTime());
        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);
        
        // Normalize timestamp to 0-1 range
        const normalized = (timestamp - minTimestamp) / (maxTimestamp - minTimestamp);
        
        // Use a color gradient from blue (old) to red (new)
        const hue = (1 - normalized) * 240; // 240 (blue) to 0 (red)
        const color = `hsl(${hue}, 100%, 50%)`;
        this.colorCache.set(date, color);
        return color;
    }

    draw() {
        // Colors for each SS (10 visually distinct, base RGB)
        const baseColors = [
            [79, 163, 255],    // blue
            [255, 82, 82],     // red
            [76, 175, 80],     // green
            [255, 193, 7],     // yellow
            [156, 39, 176],    // purple
            [255, 152, 0],     // orange
            [233, 30, 99],     // pink
            [0, 188, 212],     // cyan
            [121, 85, 72],     // brown
            [158, 158, 158]    // gray
        ];
        // Throttle draw calls to max 60fps
        const now = performance.now();
        if (now - this._lastDrawTime < 16) {
            if (!this._drawQueued) {
                this._drawQueued = true;
                setTimeout(() => {
                    this._drawQueued = false;
                    this.draw();
                }, 16 - (now - this._lastDrawTime));
            }
            return;
        }
        this._lastDrawTime = now;
        if (this.paused) return;
        this.visible = this.getVisibleRange();
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = this.getPadding();
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Clear canvas
        ctx.fillStyle = '#181c24';
        ctx.fillRect(0, 0, width, height);

        // Set text style for coordinates
        ctx.font = '12px Arial';
        ctx.fillStyle = '#e6eaf3';

        // Draw grid and coordinates
        ctx.strokeStyle = '#2c3242';
        ctx.lineWidth = 1;

        // Calculate visible range based on zoom and offset
        const visibleRange = 2000 / this.zoomLevel;
        const startX = Math.max(0, Math.floor(this.offsetX / 250) * 250);
        const endX = Math.min(2000, Math.ceil((this.offsetX + visibleRange) / 250) * 250);
        const startY = Math.max(0, Math.floor(this.offsetY / 250) * 250);
        const endY = Math.min(2000, Math.ceil((this.offsetY + visibleRange) / 250) * 250);

        // Function to convert coordinate to pixel position
        const toPixelX = (x) => padding.left + ((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
        const toPixelY = (y) => height - padding.bottom - ((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

        // Draw the four edges of the graph first
        ctx.beginPath();
        // Left edge
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        // Bottom edge
        ctx.lineTo(width - padding.right, height - padding.bottom);
        // Right edge
        ctx.lineTo(width - padding.right, padding.top);
        // Top edge
        ctx.lineTo(padding.left, padding.top);
        ctx.stroke();
        
        // Draw vertical lines and x-coordinates
        for (let i = startX; i <= endX; i += 250) {
            const x = toPixelX(i);
            
            // Only draw grid lines within the graph boundaries
            if (x >= padding.left && x <= width - padding.right) {
                // Draw grid line
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, height - padding.bottom);
                ctx.stroke();
            }

            // Draw bottom tick and label
            ctx.beginPath();
            ctx.moveTo(x, height - padding.bottom);
            ctx.lineTo(x, height - padding.bottom + 5);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(i.toString(), x, height - padding.bottom + 20);

            // Draw top tick and label
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top - 5);
            ctx.stroke();
            ctx.fillText(i.toString(), x, padding.top - 10);
        }

        // Draw horizontal lines and y-coordinates
        for (let i = startY; i <= endY; i += 250) {
            const y = toPixelY(i);
            
            // Only draw grid lines within the graph boundaries
            if (y >= padding.top && y <= height - padding.bottom) {
                // Draw grid line
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
            }

            // Draw left tick and label
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left - 5, y);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(i.toString(), padding.left - 10, y + 4);

            // Draw right tick and label
            ctx.beginPath();
            ctx.moveTo(width - padding.right, y);
            ctx.lineTo(width - padding.right + 5, y);
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.fillText(i.toString(), width - padding.right + 10, y + 4);
        }

        // Draw colorbar if showing journey
        if (this.showPlayerJourney && this.journalData && this.journalData.fullJournal.length > 0) {
            const colorbarWidth = 20;
            const colorbarHeight = graphHeight;
            const colorbarX = width - padding.right + 50;
            const colorbarY = padding.top;

            // Draw colorbar background
            ctx.fillStyle = '#23283a';
            ctx.fillRect(colorbarX - 5, colorbarY - 5, colorbarWidth + 10, colorbarHeight + 10);

            // Create gradient with multiple color stops: blue, cyan, green, yellow, red
            const gradient = ctx.createLinearGradient(0, colorbarY + colorbarHeight, 0, colorbarY);
            gradient.addColorStop(0.00, 'hsl(240, 100%, 50%)');   // Blue (oldest)
            gradient.addColorStop(0.25, 'hsl(180, 100%, 50%)');   // Cyan
            gradient.addColorStop(0.50, 'hsl(120, 100%, 50%)');   // Green
            gradient.addColorStop(0.75, 'hsl(60, 100%, 50%)');    // Yellow
            gradient.addColorStop(1.00, 'hsl(0, 100%, 50%)');     // Red (newest)
            ctx.fillStyle = gradient;
            ctx.fillRect(colorbarX, colorbarY, colorbarWidth, colorbarHeight);

            // Get min and max dates
            const dates = this.journalData.fullJournal.map(entry => new Date(entry.date));
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            
            // Format dates
            const formatDate = (date) => {
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                });
            };

            // Draw ticks and labels (oldest at bottom, newest at top)
            const numTicks = 5;
            ctx.fillStyle = '#e6eaf3';
            ctx.textAlign = 'left';
            ctx.font = '10px Arial';
            
            for (let i = 0; i <= numTicks; i++) {
                const y = colorbarY + (colorbarHeight * i / numTicks);
                const date = new Date(minDate.getTime() + (maxDate.getTime() - minDate.getTime()) * (1 - i / numTicks));
                
                // Draw tick line
                ctx.beginPath();
                ctx.moveTo(colorbarX + colorbarWidth + 2, y);
                ctx.lineTo(colorbarX + colorbarWidth + 5, y);
                ctx.strokeStyle = '#e6eaf3';
                ctx.stroke();
                
                // Draw date label
                ctx.fillText(formatDate(date), colorbarX + colorbarWidth + 8, y + 3);
            }
        }

        // Draw player position if available and showCurrentPosition is true
        if (this.showCurrentPosition && this.playerPosition) {
            const x = toPixelX(this.playerPosition.coordinate_x);
            const y = toPixelY(this.playerPosition.coordinate_y);

            // Only draw if within visible area and graph boundaries
            if (x >= padding.left && x <= width - padding.right &&
                y >= padding.top && y <= height - padding.bottom) {
                
                // Draw expanding ripples
                this.ripples.forEach(ripple => {
                    ctx.beginPath();
                    ctx.arc(x, y, ripple.size, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.opacity})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                });
            }
        }

        // Draw systems if showPublicSystems is true
        if (this.showPublicSystems) {
            this.systems.forEach((system, index) => {

                if (system.coordinate_x < this.visible.left ||
                    system.coordinate_x > this.visible.right ||
                    system.coordinate_y < this.visible.top ||
                    system.coordinate_y > this.visible.bottom) { 
                        return; 
                }

                const x = toPixelX(system.coordinate_x);
                const y = toPixelY(system.coordinate_y);

                // Only draw systems that are within the visible area and graph boundaries
                if (x >= padding.left && x <= width - padding.right &&
                    y >= padding.top && y <= height - padding.bottom) {
                    
                    // Set color based on whether it's a starter system
                    ctx.fillStyle = system.starter ? '#4CAF50' : '#FF5252';
                    
                    // Draw system point as a square (2x2 pixels)
                    const size = this.hoveredSystem === system ? 7 : 5;
                    ctx.fillRect(x - size/2, y - size/2, size, size);

                    // Draw system name if hovered
                    if (this.hoveredSystem === system) {
                        ctx.font = '14px Arial';
                        ctx.fillStyle = '#e6eaf3';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${system.name} (${system.coordinate_x}, ${system.coordinate_y})`, x, y - 10);
                    }
                }
            });
        }

        // Draw player journey if enabled (moved to the end to ensure it's drawn on top)
        if (this.showPlayerJourney && this.journalData && this.journalData.fullJournal.length > 0) {
            // Create a map to store the latest visit date for each system
            const systemVisits = new Map();
            this.journalData.fullJournal.forEach(entry => {
                systemVisits.set(entry.coordinate_x + ',' + entry.coordinate_y, entry.date);
            });

            // Draw journey points
            systemVisits.forEach((date, coords) => {
                const [x, y] = coords.split(',').map(Number);
                const pixelX = toPixelX(x);
                const pixelY = toPixelY(y);

                if (x < this.visible.left ||
                    x > this.visible.right ||
                    y < this.visible.top ||
                    y > this.visible.bottom) {
                    return; // This skips points that are NOT visible
                }

                // Only draw if within visible area and graph boundaries
                if (pixelX >= padding.left && pixelX <= width - padding.right &&
                    pixelY >= padding.top && pixelY <= height - padding.bottom) {
                    
                    // Draw journey point
                    ctx.fillStyle = this.getColorFromDate(date);
                    const isHovered = this.hoveredJourneyPoint && 
                                    this.hoveredJourneyPoint.x === x && 
                                    this.hoveredJourneyPoint.y === y;
                    const size = isHovered ? 7 : 4;
                    ctx.beginPath();
                    ctx.arc(pixelX, pixelY, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw tooltip for hovered point
                    if (isHovered) {
                        const visitDate = new Date(date);
                        const formattedDate = visitDate.toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });

                        // Draw tooltip background
                        ctx.font = '12px Arial';
                        const textWidth = ctx.measureText(formattedDate).width;
                        const tooltipX = pixelX + 10;
                        const tooltipY = pixelY - 10;
                        
                        ctx.fillStyle = 'rgba(35, 40, 58, 0.9)';
                        ctx.fillRect(tooltipX - 5, tooltipY - 20, textWidth + 10, 25);
                        
                        // Draw tooltip text
                        ctx.fillStyle = '#e6eaf3';
                        ctx.textAlign = 'left';
                        ctx.fillText(formattedDate, tooltipX, tooltipY);
                    }
                }
            });
        }

        // Draw space station ellipses
        if (this.showSpaceStations) {
                    this.ctx.save();
                    this.ctx.beginPath();
            // Define a clipping region to the graph area
                    this.ctx.rect(padding.left, padding.top, graphWidth, graphHeight);
                    this.ctx.clip();

            // For each space station, draw its range circle and then its marker
            for (let idx = 0; idx < this.squadronSpaceStations.length; idx++) {
                const ss = this.squadronSpaceStations[idx];
                const rgb = baseColors[idx % baseColors.length];
                const px = toPixelX(ss.x);
                const py = toPixelY(ss.y);
                // --- Draw range circle ---
                const rangeLevel = ss.range ?? 0;
                const rangeLy = 10 + rangeLevel;
                // Convert range in light years to pixels on canvas (handle non-square aspect ratio)
                const radiusX = (rangeLy / 2000.0) * graphWidth * this.zoomLevel;
                const radiusY = (rangeLy / 2000.0) * graphHeight * this.zoomLevel;

                const circleColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`; // 60% transparent

                this.ctx.beginPath();
                this.ctx.ellipse(px, py, radiusX, radiusY, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = circleColor;
                this.ctx.fill();

                // --- Draw marker on top ---
                const markerColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(px, py, 5, 0, Math.PI * 2);
                this.ctx.fillStyle = markerColor;
                this.ctx.shadowColor = '#000';
                this.ctx.shadowBlur = 8;
                this.ctx.fill();
                this.ctx.restore();
                
                // Draw marker border
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(px, py, 5, 0, Math.PI * 2);
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = '#fff';
                this.ctx.stroke();
                this.ctx.restore();
            }
            this.ctx.restore(); // remove clipping
        }

        // Draw squadron space station tooltip if hovered
        if (this.showSpaceStations && this.hoveredSpaceStation) {
            const ss = this.hoveredSpaceStation;
            const px = toPixelX(ss.x);
            const py = toPixelY(ss.y);
            
            // Find the index of this space station to get its color
            const ssIndex = this.squadronSpaceStations.findIndex(station => 
                station.x === ss.x && station.y === ss.y && station.name === ss.name
            );
            
            // Get the color for this space station
            const rgb = baseColors[ssIndex % baseColors.length];
            const borderColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            
            // Tooltip content
            const lines = [
                `${ss.name}`,
                `System: ${ss.system?.name || ''} (${ss.x}, ${ss.y})`,
                `Range level: ${ss.range ?? 0}`,
                `Exploring level: ${ss.exploring ?? 0}`,
                `Astronomiy level: ${ss.astronomy ?? 0}`,
                `Portal level: ${ss.portal ?? 0}`,
                `Space portal: ${ss.space_portal ? 'Yes' : 'No'}`
            ];
            this.ctx.font = '13px Arial';
            const textWidth = Math.max(...lines.map(line => this.ctx.measureText(line).width));
            const tooltipX = px + 12;
            const tooltipY = py - 10;
            const tooltipHeight = lines.length * 18 + 10;
            // Draw background
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(35, 40, 58, 0.95)';
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(tooltipX - 7, tooltipY - 22, textWidth + 18, tooltipHeight, 7);
            this.ctx.fill();
            this.ctx.stroke();
            // Draw text
            this.ctx.fillStyle = '#e6eaf3';
            for (let i = 0; i < lines.length; i++) {
                this.ctx.fillText(lines[i], tooltipX, tooltipY + i * 18);
            }
            this.ctx.restore();
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const padding = this.getPadding();
        const graphWidth = this.canvas.width - padding.left - padding.right;
        const graphHeight = this.canvas.height - padding.top - padding.bottom;

        if (this.isDragging) {
            // Calculate the movement in coordinate space
            const dx = (x - this.lastX) / (graphWidth * this.zoomLevel) * 2000;
            const dy = (y - this.lastY) / (graphHeight * this.zoomLevel) * 2000;
            
            // Update offset (negative because we want to move the map in the opposite direction of the drag)
            this.offsetX -= dx;
            this.offsetY += dy; // Positive because y-axis is inverted

            // Ensure the offset stays within bounds
            const maxOffset = 2000 * (1 - 1/this.zoomLevel);
            this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
            this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));

            this.lastX = x;
            this.lastY = y;
            this.draw();
            return;
        }

        // Check if mouse is over any journey point first
        if (this.showPlayerJourney && this.journalData && this.journalData.fullJournal.length > 0) {
            let foundJourneyPoint = false;
            const systemVisits = new Map();
            this.journalData.fullJournal.forEach(entry => {
                systemVisits.set(entry.coordinate_x + ',' + entry.coordinate_y, entry.date);
            });

            for (const [coords, date] of systemVisits) {
                const [coordX, coordY] = coords.split(',').map(Number);
                const pixelX = padding.left + ((coordX - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
                const pixelY = this.canvas.height - padding.bottom - ((coordY - this.offsetY) / 2000) * graphHeight * this.zoomLevel;
                
                const distance = Math.sqrt(Math.pow(x - pixelX, 2) + Math.pow(y - pixelY, 2));
                
                if (distance < 10) {
                    this.hoveredJourneyPoint = { x: coordX, y: coordY, date: date };
                    this.hoveredSystem = null;
                    foundJourneyPoint = true;
                    break;
                }
            }
            
            if (!foundJourneyPoint) {
                this.hoveredJourneyPoint = null;
            }
        }

        // If not hovering over a journey point, check for systems
        if (!this.hoveredJourneyPoint) {
            let found = false;
            for (const system of this.systems) {
                const systemX = padding.left + ((system.coordinate_x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
                const systemY = this.canvas.height - padding.bottom - ((system.coordinate_y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;
                const distance = Math.sqrt(Math.pow(x - systemX, 2) + Math.pow(y - systemY, 2));

                if (distance < 10) {
                    this.hoveredSystem = system;
                    found = true;
                    break;
                }
            }

            if (!found) {
                this.hoveredSystem = null;
            }
        }

        // Check if mouse is over any squadron space station
        if (this.showSpaceStations && this.squadronSpaceStations && this.squadronSpaceStations.length > 0) {
            let foundSS = false;
            for (const ss of this.squadronSpaceStations) {
                const ssX = padding.left + ((ss.x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
                const ssY = this.canvas.height - padding.bottom - ((ss.y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;
                const distance = Math.sqrt(Math.pow(x - ssX, 2) + Math.pow(y - ssY, 2));
                if (distance < 10) {
                    this.hoveredSpaceStation = ss;
                    this.hoveredJourneyPoint = null;
                    this.hoveredSystem = null;
                    foundSS = true;
                    break;
                }
            }
            if (!foundSS) {
                this.hoveredSpaceStation = null;
            }
        } else {
            this.hoveredSpaceStation = null;
        }

        this.draw();
    }

    handleMouseDown(e) {
        this.isDragging = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate the coordinate under the mouse before zoom
        const padding = this.getPadding();
        const graphWidth = this.canvas.width - padding.left - padding.right;
        const graphHeight = this.canvas.height - padding.top - padding.bottom;
        
        const coordX = this.offsetX + ((mouseX - padding.left) / (graphWidth * this.zoomLevel)) * 2000;
        const coordY = this.offsetY + ((this.canvas.height - mouseY - padding.bottom) / (graphHeight * this.zoomLevel)) * 2000;

        // Update zoom level
        const delta = e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        const newZoomLevel = this.zoomLevel * zoomFactor;
        
        // Prevent zooming out beyond initial view
        if (newZoomLevel < 1) {
            this.zoomLevel = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.draw();
            return;
        }
        
        // Limit maximum zoom (increased by 100%)
        this.zoomLevel = Math.min(100, newZoomLevel);

        // Calculate new offset to keep the point under the mouse in the same position
        const newCoordX = this.offsetX + ((mouseX - padding.left) / (graphWidth * this.zoomLevel)) * 2000;
        const newCoordY = this.offsetY + ((this.canvas.height - mouseY - padding.bottom) / (graphHeight * this.zoomLevel)) * 2000;
        
        this.offsetX += (coordX - newCoordX);
        this.offsetY += (coordY - newCoordY);

        // Ensure the offset stays within bounds
        const maxOffset = 2000 * (1 - 1/this.zoomLevel);
        this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
        this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));

        this.draw();
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            this.isPinching = true;
            this.touchStartDistance = this.getDistance(e.touches[0], e.touches[1]);
            this.touchStartZoomLevel = this.zoomLevel;
            this.touchStartOffsetX = this.offsetX;
            this.touchStartOffsetY = this.offsetY;
            this.touchStartCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            this.touchStartCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        } else if (e.touches.length === 1) {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastTouchTime;
            
            // Check for double tap (within 300ms)
            if (timeDiff < 300 && timeDiff > 0) {
                // Double tap detected - zoom in/out
                const rect = this.canvas.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                
                if (this.zoomLevel > 1) {
                    // Zoom out to fit all
                    this.zoomLevel = 1;
                    this.offsetX = 0;
                    this.offsetY = 0;
                } else {
                    // Zoom in to 2x
                    this.zoomLevel = 2;
                    
                    // Calculate the coordinate under the tap point
                    const padding = this.getPadding();
                    const graphWidth = this.canvas.width - padding.left - padding.right;
                    const graphHeight = this.canvas.height - padding.top - padding.bottom;
                    
                    const coordX = this.offsetX + ((x - padding.left) / (graphWidth * 1)) * 2000;
                    const coordY = this.offsetY + ((this.canvas.height - y - padding.bottom) / (graphHeight * 1)) * 2000;
                    
                    // Center the view on the tapped point
                    this.offsetX = coordX - (graphWidth * this.zoomLevel / 2 / graphWidth) * 2000;
                    this.offsetY = coordY - (graphHeight * this.zoomLevel / 2 / graphHeight) * 2000;
                    
                    // Ensure the offset stays within bounds
                    const maxOffset = 2000 * (1 - 1/this.zoomLevel);
                    this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
                    this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));
                }
                
                this.draw();
                this.lastTouchTime = 0; // Reset to prevent triple tap
                return;
            }
            
            this.lastTouchTime = currentTime;
            this.isDragging = true;
            this.lastX = e.touches[0].clientX - this.canvas.getBoundingClientRect().left;
            this.lastY = e.touches[0].clientY - this.canvas.getBoundingClientRect().top;
        }
    }

    handleTouchMove(e) {
        e.preventDefault(); // Prevent default touch behavior
        
        if (this.isPinching && e.touches.length === 2) {
            const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
            const zoomFactor = currentDistance / this.touchStartDistance;
            const newZoomLevel = this.touchStartZoomLevel * zoomFactor;
            
            // Limit zoom levels
            if (newZoomLevel < 1) {
                this.zoomLevel = 1;
                this.offsetX = 0;
                this.offsetY = 0;
            } else {
                this.zoomLevel = Math.min(100, newZoomLevel);
                
                // Calculate the center point between the two touches
                const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                
                // Calculate the coordinate under the center point before zoom
                const rect = this.canvas.getBoundingClientRect();
                const padding = this.getPadding();
                const graphWidth = this.canvas.width - padding.left - padding.right;
                const graphHeight = this.canvas.height - padding.top - padding.bottom;
                
                const coordX = this.touchStartOffsetX + ((currentCenterX - rect.left - padding.left) / (graphWidth * this.touchStartZoomLevel)) * 2000;
                const coordY = this.touchStartOffsetY + ((this.canvas.height - (currentCenterY - rect.top) - padding.bottom) / (graphHeight * this.touchStartZoomLevel)) * 2000;
                
                // Calculate new offset to keep the point under the center in the same position
                const newCoordX = this.offsetX + ((currentCenterX - rect.left - padding.left) / (graphWidth * this.zoomLevel)) * 2000;
                const newCoordY = this.offsetY + ((this.canvas.height - (currentCenterY - rect.top) - padding.bottom) / (graphHeight * this.zoomLevel)) * 2000;
                
                this.offsetX += (coordX - newCoordX);
                this.offsetY += (coordY - newCoordY);
                
                // Ensure the offset stays within bounds
                const maxOffset = 2000 * (1 - 1/this.zoomLevel);
                this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
                this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));
            }
            
            this.draw();
        } else if (this.isDragging && e.touches.length === 1) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            // Calculate the movement in coordinate space
            const padding = this.getPadding();
            const graphWidth = this.canvas.width - padding.left - padding.right;
            const graphHeight = this.canvas.height - padding.top - padding.bottom;
            
            const dx = (x - this.lastX) / (graphWidth * this.zoomLevel) * 2000;
            const dy = (y - this.lastY) / (graphHeight * this.zoomLevel) * 2000;
            
            // Update offset (negative because we want to move the map in the opposite direction of the drag)
            this.offsetX -= dx;
            this.offsetY += dy; // Positive because y-axis is inverted

            // Ensure the offset stays within bounds
            const maxOffset = 2000 * (1 - 1/this.zoomLevel);
            this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
            this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));

            this.lastX = x;
            this.lastY = y;
            this.draw();
        }
    }

    handleTouchEnd(e) {
        this.isPinching = false;
        this.isDragging = false;
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getPadding() {
        // Adjust padding based on screen size for better mobile experience
        const isMobile = this.canvas.width < 768;
        if (isMobile) {
            return {
                left: 35,
                right: 80,
                top: 30,
                bottom: 30
            };
        } else {
            return {
                left: 60,
                right: 160,
                top: 40,
                bottom: 40
            };
        }
    }
}

// Initialize the map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    let universeMap = null;

    // Function to initialize the map
    function initializeMap() {
        if (!universeMap) {
            universeMap = new UniverseMap('universeMap');
        }
        universeMap.draw();
    }

    // Add button to load systems
    const loadButton = document.getElementById('loadSystemsBtn');
    const apiKeyInput = document.getElementById('systems_api_key');
    
    // Load saved API key from localStorage
    if (apiKeyInput) {
        const savedApiKey = localStorage.getItem('systems_api_key');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }
    }
    
    if (loadButton && apiKeyInput) {
        loadButton.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            if (!apiKey) {
                alert('Please enter your API key');
                return;
            }

            // Save API key to localStorage
            localStorage.setItem('systems_api_key', apiKey);

            try {
                loadButton.disabled = true;
                loadButton.textContent = 'Loading...';

                // Load systems
                const systemsResponse = await fetch('https://api.stellarodyssey.app/api/public/systems', {
                    headers: {
                        'Accept': 'application/json',
                        'sodyssey-api-key': apiKey
                    }
                });

                if (!systemsResponse.ok) {
                    throw new Error(`Server responded with status ${systemsResponse.status}`);
                }

                const systemsData = await systemsResponse.json();
                universeMap.loadSystems(systemsData);

                // Add a 1 second delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Load journal
                const journalResponse = await fetch('https://api.stellarodyssey.app/api/public/journal', {
                    headers: {
                        'Accept': 'application/json',
                        'sodyssey-api-key': apiKey
                    }
                });

                if (!journalResponse.ok) {
                    throw new Error(`Server responded with status ${journalResponse.status}`);
                }

                const journalData = await journalResponse.json();
                if (journalData.fullJournal && journalData.fullJournal.length > 0) {
                    universeMap.setPlayerPosition(journalData.fullJournal[0]);
                    universeMap.setJournalData(journalData);
                }

                // Fetch user API for squadronSpaceStations
                const userResponse = await fetch('https://api.stellarodyssey.app/api/public/user', {
                    headers: {
                        'Accept': 'application/json',
                        'sodyssey-api-key': apiKey
                    }
                });
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.data && userData.data.squadronSpaceStations && Array.isArray(userData.data.squadronSpaceStations)) {
                        universeMap.squadronSpaceStations = userData.data.squadronSpaceStations.map(ss => ({
                            ...ss,
                            x: ss.system.coordinate_x,
                            y: ss.system.coordinate_y
                        }));
                        universeMap.draw();
                    }
                }
                
                loadButton.disabled = false;
                loadButton.textContent = 'Load Systems';
            } catch (error) {
                alert('Failed to load data: ' + error.message);
                loadButton.disabled = false;
                loadButton.textContent = 'Load Systems';
            }
        });
    }

    // Add event listener for tab switching
    const universeMapTab = document.querySelector('.tab[data-tab="universe-map-tab"]');
    if (universeMapTab) {
        universeMapTab.addEventListener('click', () => {
            // Initialize and draw the map when switching to the universe map tab
            initializeMap();
        });
    }

    // Initialize the map immediately if we're on the universe map tab
    if (document.getElementById('universe-map-tab').classList.contains('active')) {
        initializeMap();
    }
}); 
 
