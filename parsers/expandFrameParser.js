import { BaseParser } from './parserRegistry.js';

export default class ExpandFrameParser extends BaseParser {
    constructor() {
        super();
        this.id = 'expandFrame';
        this.name = 'ExpandFrame Crash Parser';
        this.version = '1.0.0';
        this.description = 'Specialized parser for TextBubbleStickerView expandFrameWithSize crashes';
        this.targetCrashEvent = '-[TextBubbleStickerView expandFrameWithSize:]';
    }

    async parse(logContent) {
        const lines = logContent.split('\n');
        const data = {
            textStyleGuids: [],
            frameChanges: [],
            renderSizes: [],
            spacingChanges: [],
            letterSpacingEvents: [],
            lineSpacingEvents: [],
            renderTasks: [],
            allEvents: [] // Timeline of all events
        };

        let inActionBlock = false;
        let currentActionData = {};
        let actionStartLine = 0;
        let actionTimestamp = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === 'Action:{' || line.endsWith('Action:{')) {
                inActionBlock = true;
                currentActionData = {};
                
                if (line.endsWith('Action:{')) {
                    const parsed = this.parseLogLine(line);
                    if (parsed) {
                        actionStartLine = parsed.lineNumber;
                        actionTimestamp = parsed.timestamp;
                    }
                } else if (i > 0) {
                    const prevParsed = this.parseLogLine(lines[i-1].trim());
                    if (prevParsed) {
                        actionStartLine = prevParsed.lineNumber;
                        actionTimestamp = prevParsed.timestamp;
                    }
                }
                continue;
            }

            if (inActionBlock) {
                if (line === '}') {
                    inActionBlock = false;
                    
                    if (currentActionData.text_style_guid) {
                        const event = {
                            line: actionStartLine,
                            timestamp: actionTimestamp,
                            guid: currentActionData.text_style_guid,
                            operation: currentActionData.operation || '',
                            feature_name: currentActionData.feature_name || '',
                            text_category: currentActionData.text_category || '',
                            type: 'textStyleGuid'
                        };
                        data.textStyleGuids.push(event);
                        data.allEvents.push(event);
                    }

                    currentActionData = {};
                    continue;
                }

                if (line.includes(':')) {
                    const colonIndex = line.indexOf(':');
                    const key = line.substring(0, colonIndex);
                    const value = line.substring(colonIndex + 1);
                    currentActionData[key] = value;
                }
                continue;
            }

            const parsed = this.parseLogLine(line);
            if (!parsed) continue;

            const { lineNumber, timestamp, content } = parsed;

            // Parse letter spacing events
            if (content.includes('letterSpacing=') && content.includes('new letterSpacing=')) {
                const currentMatch = content.match(/Current letterSpacing=([0-9.-]+)/);
                const newMatch = content.match(/new letterSpacing=([0-9.-]+)/);
                const changedMatch = content.match(/changed=([01])/);
                
                if (currentMatch && newMatch) {
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'letterSpacing',
                        currentValue: parseFloat(currentMatch[1]),
                        newValue: parseFloat(newMatch[1]),
                        changed: changedMatch ? parseInt(changedMatch[1]) === 1 : false,
                        delta: parseFloat(newMatch[1]) - parseFloat(currentMatch[1])
                    };
                    data.letterSpacingEvents.push(event);
                    data.allEvents.push(event);
                }
            }

            // Parse line spacing events
            if (content.includes('lineSpacing=') && content.includes('new lineSpacing=')) {
                const currentMatch = content.match(/Current lineSpacing=([0-9.-]+)/);
                const newMatch = content.match(/new lineSpacing=([0-9.-]+)/);
                const changedMatch = content.match(/changed=([01])/);
                
                if (currentMatch && newMatch) {
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'lineSpacing',
                        currentValue: parseFloat(currentMatch[1]),
                        newValue: parseFloat(newMatch[1]),
                        changed: changedMatch ? parseInt(changedMatch[1]) === 1 : false,
                        delta: parseFloat(newMatch[1]) - parseFloat(currentMatch[1])
                    };
                    data.lineSpacingEvents.push(event);
                    data.allEvents.push(event);
                }
            }

            // Parse spacing degree value changes
            if (content.includes('degreeValueChangedByLetterSpacing:') && content.includes('letterSpacingValue=')) {
                const letterMatch = content.match(/letterSpacingValue=([0-9.-]+)/);
                const lineMatch = content.match(/lineSpacingValue=([0-9.-]+)/);
                const modeMatch = content.match(/mode=([0-9]+)/);
                
                if (letterMatch || lineMatch) {
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'spacingDegreeChange',
                        letterSpacingValue: letterMatch ? parseFloat(letterMatch[1]) : null,
                        lineSpacingValue: lineMatch ? parseFloat(lineMatch[1]) : null,
                        mode: modeMatch ? parseInt(modeMatch[1]) : null
                    };
                    data.spacingChanges.push(event);
                    data.allEvents.push(event);
                }
            }

            // Parse render task events
            if (content.includes('Executing new render task') || content.includes('render task')) {
                const event = {
                    line: lineNumber,
                    timestamp: timestamp,
                    type: 'renderTask',
                    description: content.includes('Executing new render task') ? 'New render task started' : 'Render task event'
                };
                data.renderTasks.push(event);
                data.allEvents.push(event);
            }

            // Existing frame size parsing
            if (content.includes('expandFrameWithSize:') || content.includes('expandFrameSize:')) {
                const frameSizeMatch = content.match(/size=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (frameSizeMatch) {
                    const width = parseFloat(frameSizeMatch[1]);
                    const height = parseFloat(frameSizeMatch[2]);
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'frameChange',
                        frameType: 'expand',
                        width: width,
                        height: height
                    };
                    data.frameChanges.push(event);
                    data.allEvents.push(event);
                }

                const currentFrameMatch = content.match(/current frameSize=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (currentFrameMatch) {
                    const width = parseFloat(currentFrameMatch[1]);
                    const height = parseFloat(currentFrameMatch[2]);
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'frameChange',
                        frameType: 'current',
                        width: width,
                        height: height
                    };
                    data.frameChanges.push(event);
                    data.allEvents.push(event);
                }

                const newFrameMatch = content.match(/newFrame=\{\{[0-9., ]+\},\s*\{([0-9.-]+),\s*([0-9.-]+)\}\}/);
                if (newFrameMatch) {
                    const width = parseFloat(newFrameMatch[1]);
                    const height = parseFloat(newFrameMatch[2]);
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'frameChange',
                        frameType: 'new',
                        width: width,
                        height: height
                    };
                    data.frameChanges.push(event);
                    data.allEvents.push(event);
                }
            }

            // Existing render size parsing
            if (content.includes('renderSize=')) {
                const renderMatch = content.match(/renderSize=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (renderMatch) {
                    const width = parseFloat(renderMatch[1]);
                    const height = parseFloat(renderMatch[2]);
                    const ratio = height !== 0 ? width / height : Infinity;
                    const event = {
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'renderSize',
                        width: width,
                        height: height,
                        ratio: ratio
                    };
                    data.renderSizes.push(event);
                    data.allEvents.push(event);
                }
            }
        }

        // Sort all events by line number for timeline
        data.allEvents.sort((a, b) => a.line - b.line);

        return data;
    }

    async displayResults(data, containers) {
        // Enhanced analysis
        const crashAnalysis = this.performComprehensiveCrashAnalysis(data);
        const severity = this.assessCrashSeverity(data);
        
        const summaryHTML = [
            this.createSummaryCard('Text Style GUIDs', data.textStyleGuids.length),
            this.createSummaryCard('Frame Changes', data.frameChanges.length, severity === 'critical' ? 'critical-card' : ''),
            this.createSummaryCard('Letter Spacing', data.letterSpacingEvents.length),
            this.createSummaryCard('Line Spacing', data.lineSpacingEvents.length),
            this.createSummaryCard('Render Tasks', data.renderTasks.length),
            this.createSummaryCard('Total Events', data.allEvents.length),
            this.createSummaryCard('Crash Severity', severity.toUpperCase(), severity === 'critical' ? 'critical-card' : severity === 'warning' ? 'warning-card' : '')
        ].join('');

        containers.summaryContainer.innerHTML = summaryHTML;

        let contentHTML = '';
        
        // Timeline Section with Filters (First and most important)
        contentHTML += this.createTimelineSection(data);
        
        // Crash Analysis
        if (crashAnalysis.hasCrash) {
            contentHTML += this.createCrashAnalysisSection(crashAnalysis);
        }
        
        // Spacing Analysis
        contentHTML += this.createAnalysisSection('📏 Letter & Line Spacing Analysis', this.analyzeSpacingEvents(data));
        
        // Existing sections
        contentHTML += this.createAnalysisSection('📋 Text Style GUID Analysis', this.analyzeGuids(data.textStyleGuids));
        contentHTML += this.createAnalysisSection('📐 Frame Size Evolution & Critical Analysis', this.analyzeFrameChangesComprehensive(data.frameChanges, data.renderSizes));
        contentHTML += this.createAnalysisSection('🔍 Render Size Diagnostics', this.analyzeRenderSizes(data.renderSizes));
        contentHTML += this.createAnalysisSection('📊 Statistical Summary', this.generateStatisticalSummary(data));
        contentHTML += this.createAnalysisSection('💡 Recommendations', this.generateRecommendations(crashAnalysis, data));

        containers.contentContainer.innerHTML = contentHTML;

        // Add event listeners for timeline filters
        this.setupTimelineFilters(data);
    }

    createTimelineSection(data) {
        const eventTypes = [
            { value: 'frameChange', label: 'Frame Changes', count: data.frameChanges.length },
            { value: 'letterSpacing', label: 'Letter Spacing', count: data.letterSpacingEvents.length },
            { value: 'lineSpacing', label: 'Line Spacing', count: data.lineSpacingEvents.length },
            { value: 'spacingDegreeChange', label: 'Spacing Degree Changes', count: data.spacingChanges.length },
            { value: 'renderTask', label: 'Render Tasks', count: data.renderTasks.length },
            { value: 'renderSize', label: 'Render Sizes', count: data.renderSizes.length },
            { value: 'textStyleGuid', label: 'Text Style GUIDs', count: data.textStyleGuids.length }
        ].filter(type => type.count > 0);

        let html = `
            <div class="analysis-section">
                <h2>📅 Event Timeline</h2>
                <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 15px; font-weight: bold;">Filter Events (select multiple):</label>
                        <div style="background: #f8f9fa; border: 1px solid #ced4da; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                <label style="display: flex; align-items: center; cursor: pointer; padding: 5px;">
                                    <input type="checkbox" id="filter-all" class="event-filter-checkbox" value="all" checked style="margin-right: 8px; transform: scale(1.2);">
                                    <span style="font-weight: 500;">All Events (${data.allEvents.length})</span>
                                </label>
        `;

        eventTypes.forEach(type => {
            const eventTypeConfig = this.getEventTypeConfig(type.value);
            html += `
                                <label style="display: flex; align-items: center; cursor: pointer; padding: 5px;">
                                    <input type="checkbox" class="event-filter-checkbox" value="${type.value}" checked style="margin-right: 8px; transform: scale(1.2);">
                                    <span style="color: ${eventTypeConfig.color}; margin-right: 5px;">${eventTypeConfig.icon}</span>
                                    <span>${type.label} (${type.count})</span>
                                </label>`;
        });

        html += `
                            </div>
                            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #dee2e6;">
                                <button id="selectAllFilters" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; font-size: 12px;">Select All</button>
                                <button id="clearAllFilters" style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; font-size: 12px;">Clear All</button>
                                <span id="selectedCount" style="font-size: 12px; color: #6c757d;">All types selected</span>
                            </div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            <button id="showCriticalOnly" style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Show Critical Only</button>
                            <button id="showRecentEvents" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Last 20 Events</button>
                            <button id="showImportantOnly" style="padding: 8px 12px; background: #ffc107; color: #212529; border: none; border-radius: 4px; cursor: pointer;">Show Important Only</button>
                        </div>
                    </div>
                    <div id="timelineContainer">
                        ${this.generateTimelineHTML(data.allEvents, ['all'])}
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    generateTimelineHTML(events, filterTypes) {
        let filteredEvents = events;
        
        // Handle array of filter types for multiple selection
        if (Array.isArray(filterTypes)) {
            if (!filterTypes.includes('all') && filterTypes.length > 0) {
                filteredEvents = events.filter(event => filterTypes.includes(event.type));
            }
        } else {
            // Backward compatibility for single filter type
            if (filterTypes !== 'all') {
                filteredEvents = events.filter(event => event.type === filterTypes);
            }
        }

        if (filteredEvents.length === 0) {
            return '<p>No events found for the selected filters.</p>';
        }

        let html = `<div style="max-height: 600px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 6px;">`;
        
        filteredEvents.forEach((event, index) => {
            const eventTypeConfig = this.getEventTypeConfig(event.type);
            const isImportant = this.isImportantEvent(event);
            const isCritical = this.isCriticalEvent(event);
            
            const cardClass = isCritical ? 'critical' : isImportant ? 'warning' : 'normal';
            const bgColor = isCritical ? '#ffe6e6' : isImportant ? '#fff9e6' : '#f8f9fa';
            const borderColor = isCritical ? '#dc3545' : isImportant ? '#ffc107' : '#dee2e6';

            html += `
                <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; margin: 8px; padding: 15px; border-radius: 6px;">
                    <div style="display: flex; justify-content: between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <span style="background: ${eventTypeConfig.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 10px;">
                                    ${eventTypeConfig.icon} ${eventTypeConfig.label}
                                </span>
                                <span style="font-weight: bold; color: #495057;">Line ${event.line}</span>
                                ${isCritical ? '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 10px;">CRITICAL</span>' : ''}
                                ${isImportant && !isCritical ? '<span style="background: #ffc107; color: #212529; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 10px;">IMPORTANT</span>' : ''}
                            </div>
                            <div style="margin-bottom: 8px;">
                                ${this.formatEventDetails(event)}
                            </div>
                            <div style="font-size: 12px; color: #6c757d;">
                                ${event.timestamp}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    getEventTypeConfig(type) {
        const configs = {
            frameChange: { icon: '📐', label: 'Frame Change', color: '#007bff' },
            letterSpacing: { icon: '📝', label: 'Letter Spacing', color: '#28a745' },
            lineSpacing: { icon: '📏', label: 'Line Spacing', color: '#17a2b8' },
            spacingDegreeChange: { icon: '🎛️', label: 'Spacing Degree', color: '#6f42c1' },
            renderTask: { icon: '🔄', label: 'Render Task', color: '#fd7e14' },
            renderSize: { icon: '📊', label: 'Render Size', color: '#e83e8c' },
            textStyleGuid: { icon: '🎨', label: 'Text Style', color: '#20c997' }
        };
        return configs[type] || { icon: '📋', label: 'Event', color: '#6c757d' };
    }

    formatEventDetails(event) {
        switch (event.type) {
            case 'frameChange':
                const frameStatus = (isNaN(event.width) || isNaN(event.height)) ? '🚨 NaN VALUES' : 
                                  (event.width === 0 || event.height === 0) ? '⚠️ ZERO DIMENSIONS' : '';
                return `<strong>${event.frameType} frame:</strong> ${event.width} x ${event.height} ${frameStatus}`;
                
            case 'letterSpacing':
                const letterChange = event.changed ? '✅ Changed' : '❌ No change';
                const letterDelta = event.delta >= 0 ? `+${event.delta.toFixed(6)}` : event.delta.toFixed(6);
                return `<strong>Letter spacing:</strong> ${event.currentValue.toFixed(6)} → ${event.newValue.toFixed(6)} (Δ${letterDelta}) ${letterChange}`;
                
            case 'lineSpacing':
                const lineChange = event.changed ? '✅ Changed' : '❌ No change';
                const lineDelta = event.delta >= 0 ? `+${event.delta.toFixed(6)}` : event.delta.toFixed(6);
                return `<strong>Line spacing:</strong> ${event.currentValue.toFixed(6)} → ${event.newValue.toFixed(6)} (Δ${lineDelta}) ${lineChange}`;
                
            case 'spacingDegreeChange':
                let details = '<strong>Spacing degree change:</strong> ';
                if (event.letterSpacingValue !== null) details += `Letter: ${event.letterSpacingValue.toFixed(6)} `;
                if (event.lineSpacingValue !== null) details += `Line: ${event.lineSpacingValue.toFixed(6)} `;
                if (event.mode !== null) details += `Mode: ${event.mode}`;
                return details;
                
            case 'renderTask':
                return `<strong>Render task:</strong> ${event.description}`;
                
            case 'renderSize':
                const renderStatus = (event.width === 0 || event.height === 0) ? '🚨 ZERO RENDER SIZE' : '';
                return `<strong>Render size:</strong> ${event.width} x ${event.height} (ratio: ${event.ratio === Infinity ? 'inf' : event.ratio.toFixed(3)}) ${renderStatus}`;
                
            case 'textStyleGuid':
                return `<strong>Text style:</strong> ${event.guid} (${event.operation}) - ${event.text_category}`;
                
            default:
                return `<strong>Event:</strong> ${event.type}`;
        }
    }

    isImportantEvent(event) {
        switch (event.type) {
            case 'frameChange':
                return (event.width === 0 || event.height === 0) || (event.width > 1000 || event.height > 1000);
            case 'letterSpacing':
            case 'lineSpacing':
                return event.changed && Math.abs(event.delta) > 0.1;
            case 'renderSize':
                return (event.width === 0 || event.height === 0) || event.ratio > 10 || event.ratio < 0.1;
            case 'spacingDegreeChange':
                return true; // All spacing degree changes are important
            case 'renderTask':
                return true; // All render tasks are important
            default:
                return false;
        }
    }

    isCriticalEvent(event) {
        switch (event.type) {
            case 'frameChange':
                return isNaN(event.width) || isNaN(event.height);
            case 'renderSize':
                return (event.width === 0 || event.height === 0);
            case 'letterSpacing':
            case 'lineSpacing':
                return isNaN(event.newValue) || isNaN(event.currentValue);
            default:
                return false;
        }
    }

    setupTimelineFilters(data) {
        // This will be called after the HTML is rendered
        setTimeout(() => {
            const filterCheckboxes = document.querySelectorAll('.event-filter-checkbox');
            const allCheckbox = document.getElementById('filter-all');
            const selectAllButton = document.getElementById('selectAllFilters');
            const clearAllButton = document.getElementById('clearAllFilters');
            const criticalButton = document.getElementById('showCriticalOnly');
            const recentButton = document.getElementById('showRecentEvents');
            const importantButton = document.getElementById('showImportantOnly');
            const timelineContainer = document.getElementById('timelineContainer');
            const selectedCount = document.getElementById('selectedCount');

            // Function to update the timeline based on selected filters
            const updateTimeline = () => {
                const selectedFilters = Array.from(filterCheckboxes)
                    .filter(cb => cb.checked && cb.value !== 'all')
                    .map(cb => cb.value);
                
                const showAll = allCheckbox.checked;
                const filterTypes = showAll ? ['all'] : selectedFilters;
                
                timelineContainer.innerHTML = this.generateTimelineHTML(data.allEvents, filterTypes);
                
                // Update selected count
                if (showAll) {
                    selectedCount.textContent = 'All types selected';
                } else {
                    selectedCount.textContent = `${selectedFilters.length} type${selectedFilters.length !== 1 ? 's' : ''} selected`;
                }
            };

            // Handle "All Events" checkbox
            if (allCheckbox) {
                allCheckbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    filterCheckboxes.forEach(cb => {
                        if (cb.value !== 'all') {
                            cb.checked = isChecked;
                            cb.disabled = isChecked;
                        }
                    });
                    updateTimeline();
                });
            }

            // Handle individual filter checkboxes
            filterCheckboxes.forEach(checkbox => {
                if (checkbox.value !== 'all') {
                    checkbox.addEventListener('change', () => {
                        // If any individual checkbox is unchecked, uncheck "All Events"
                        const anyUnchecked = Array.from(filterCheckboxes)
                            .filter(cb => cb.value !== 'all')
                            .some(cb => !cb.checked);
                        
                        if (anyUnchecked && allCheckbox.checked) {
                            allCheckbox.checked = false;
                            filterCheckboxes.forEach(cb => {
                                if (cb.value !== 'all') {
                                    cb.disabled = false;
                                }
                            });
                        }
                        
                        // If all individual checkboxes are checked, check "All Events"
                        const allChecked = Array.from(filterCheckboxes)
                            .filter(cb => cb.value !== 'all')
                            .every(cb => cb.checked);
                        
                        if (allChecked && !allCheckbox.checked) {
                            allCheckbox.checked = true;
                            filterCheckboxes.forEach(cb => {
                                if (cb.value !== 'all') {
                                    cb.disabled = true;
                                }
                            });
                        }
                        
                        updateTimeline();
                    });
                }
            });

            // Select All button
            if (selectAllButton) {
                selectAllButton.addEventListener('click', () => {
                    allCheckbox.checked = true;
                    filterCheckboxes.forEach(cb => {
                        cb.checked = true;
                        if (cb.value !== 'all') {
                            cb.disabled = true;
                        }
                    });
                    updateTimeline();
                });
            }

            // Clear All button
            if (clearAllButton) {
                clearAllButton.addEventListener('click', () => {
                    filterCheckboxes.forEach(cb => {
                        cb.checked = false;
                        cb.disabled = false;
                    });
                    updateTimeline();
                });
            }

            // Critical events button
            if (criticalButton) {
                criticalButton.addEventListener('click', () => {
                    const criticalEvents = data.allEvents.filter(event => this.isCriticalEvent(event));
                    timelineContainer.innerHTML = this.generateTimelineHTML(criticalEvents, ['all']);
                });
            }

            // Recent events button
            if (recentButton) {
                recentButton.addEventListener('click', () => {
                    const recentEvents = data.allEvents.slice(-20);
                    timelineContainer.innerHTML = this.generateTimelineHTML(recentEvents, ['all']);
                });
            }

            // Important events button
            if (importantButton) {
                importantButton.addEventListener('click', () => {
                    const importantEvents = data.allEvents.filter(event => this.isImportantEvent(event) || this.isCriticalEvent(event));
                    timelineContainer.innerHTML = this.generateTimelineHTML(importantEvents, ['all']);
                });
            }

            // Initialize with all filters selected
            updateTimeline();
        }, 100);
    }

    analyzeSpacingEvents(data) {
        let html = '';

        // Letter Spacing Analysis
        if (data.letterSpacingEvents.length > 0) {
            html += '<h4>📝 Letter Spacing Events</h4>';
            
            const significantChanges = data.letterSpacingEvents.filter(e => e.changed && Math.abs(e.delta) > 0.01);
            const nanEvents = data.letterSpacingEvents.filter(e => isNaN(e.newValue) || isNaN(e.currentValue));
            
            if (nanEvents.length > 0) {
                html += '<h5>🚨 CRITICAL: NaN Letter Spacing Values</h5>';
                nanEvents.forEach(event => {
                    html += this.createResultItem(`
                        Line ${event.line}: ${event.currentValue} → ${event.newValue}<br>
                        <small>Time: ${event.timestamp}</small>
                    `, 'critical');
                });
            }

            if (significantChanges.length > 0) {
                html += '<h5>📈 Significant Letter Spacing Changes</h5>';
                significantChanges.slice(0, 10).forEach(event => {
                    const deltaStr = event.delta >= 0 ? `+${event.delta.toFixed(6)}` : event.delta.toFixed(6);
                    html += this.createResultItem(`
                        Line ${event.line}: ${event.currentValue.toFixed(6)} → ${event.newValue.toFixed(6)} (Δ${deltaStr})<br>
                        <small>Time: ${event.timestamp}</small>
                    `, Math.abs(event.delta) > 1 ? 'warning' : 'normal');
                });
            }

            // Letter spacing statistics
            const letterValues = data.letterSpacingEvents.map(e => e.newValue).filter(v => !isNaN(v));
            if (letterValues.length > 0) {
                const min = Math.min(...letterValues);
                const max = Math.max(...letterValues);
                const avg = letterValues.reduce((sum, v) => sum + v, 0) / letterValues.length;
                
                html += this.createResultItem(`
                    <strong>Letter Spacing Range:</strong> ${min.toFixed(6)} to ${max.toFixed(6)}<br>
                    <strong>Average:</strong> ${avg.toFixed(6)} | <strong>Total Events:</strong> ${data.letterSpacingEvents.length}
                `);
            }
        }

        // Line Spacing Analysis
        if (data.lineSpacingEvents.length > 0) {
            html += '<h4>📏 Line Spacing Events</h4>';
            
            const significantChanges = data.lineSpacingEvents.filter(e => e.changed && Math.abs(e.delta) > 0.01);
            const nanEvents = data.lineSpacingEvents.filter(e => isNaN(e.newValue) || isNaN(e.currentValue));
            
            if (nanEvents.length > 0) {
                html += '<h5>🚨 CRITICAL: NaN Line Spacing Values</h5>';
                nanEvents.forEach(event => {
                    html += this.createResultItem(`
                        Line ${event.line}: ${event.currentValue} → ${event.newValue}<br>
                        <small>Time: ${event.timestamp}</small>
                    `, 'critical');
                });
            }

            if (significantChanges.length > 0) {
                html += '<h5>📈 Significant Line Spacing Changes</h5>';
                significantChanges.slice(0, 10).forEach(event => {
                    const deltaStr = event.delta >= 0 ? `+${event.delta.toFixed(6)}` : event.delta.toFixed(6);
                    html += this.createResultItem(`
                        Line ${event.line}: ${event.currentValue.toFixed(6)} → ${event.newValue.toFixed(6)} (Δ${deltaStr})<br>
                        <small>Time: ${event.timestamp}</small>
                    `, Math.abs(event.delta) > 1 ? 'warning' : 'normal');
                });
            }

            // Line spacing statistics
            const lineValues = data.lineSpacingEvents.map(e => e.newValue).filter(v => !isNaN(v));
            if (lineValues.length > 0) {
                const min = Math.min(...lineValues);
                const max = Math.max(...lineValues);
                const avg = lineValues.reduce((sum, v) => sum + v, 0) / lineValues.length;
                
                html += this.createResultItem(`
                    <strong>Line Spacing Range:</strong> ${min.toFixed(6)} to ${max.toFixed(6)}<br>
                    <strong>Average:</strong> ${avg.toFixed(6)} | <strong>Total Events:</strong> ${data.lineSpacingEvents.length}
                `);
            }
        }

        // Spacing Degree Changes Analysis
        if (data.spacingChanges.length > 0) {
            html += '<h4>🎛️ Spacing Degree Changes</h4>';
            data.spacingChanges.slice(0, 10).forEach(event => {
                let details = `Line ${event.line}: `;
                if (event.letterSpacingValue !== null) details += `Letter: ${event.letterSpacingValue.toFixed(6)} `;
                if (event.lineSpacingValue !== null) details += `Line: ${event.lineSpacingValue.toFixed(6)} `;
                if (event.mode !== null) details += `Mode: ${event.mode}`;
                
                html += this.createResultItem(`
                    ${details}<br>
                    <small>Time: ${event.timestamp}</small>
                `);
            });
        }

        // Render Tasks Analysis
        if (data.renderTasks.length > 0) {
            html += '<h4>🔄 Render Task Events</h4>';
            html += this.createResultItem(`
                <strong>Total Render Tasks:</strong> ${data.renderTasks.length}<br>
                <strong>First Task:</strong> Line ${data.renderTasks[0].line}<br>
                <strong>Last Task:</strong> Line ${data.renderTasks[data.renderTasks.length - 1].line}
            `);
        }

        if (html === '') {
            html = '<p>No spacing events found in this log.</p>';
        }

        return html;
    }

    analyzeGuids(guids) {
        if (guids.length === 0) {
            return '<p>⚠️ No text style GUIDs found in the log.</p>';
        }

        const guidCounts = {};
        guids.forEach(guid => {
            guidCounts[guid.guid] = (guidCounts[guid.guid] || 0) + 1;
        });

        let html = '<h4>Unique GUIDs Found:</h4>';
        Object.entries(guidCounts).forEach(([guid, count]) => {
            const sample = guids.find(g => g.guid === guid);
            html += this.createResultItem(`
                <strong>${guid}</strong>: ${count} times<br>
                <small>Category: ${sample.text_category || 'N/A'} | Operation: ${sample.operation || 'N/A'}</small>
            `);
        });

        return html;
    }

    analyzeFrameChangesComprehensive(frameChanges, renderSizes) {
        if (frameChanges.length === 0) {
            return '<p>⚠️ No expandFrameWithSize events found in this log.</p>';
        }

        const nanFrames = frameChanges.filter(f => isNaN(f.width) || isNaN(f.height));
        const zeroFrames = frameChanges.filter(f => f.width === 0 || f.height === 0);
        const negativeFrames = frameChanges.filter(f => f.width < 0 || f.height < 0);
        const extremeFrames = frameChanges.filter(f => f.width > 10000 || f.height > 10000);

        let html = '';

        // Critical Issues Analysis
        if (nanFrames.length > 0) {
            html += '<h4>🚨 CRITICAL: NaN Frame Values Detected</h4>';
            html += '<p><strong>This is the primary crash cause.</strong> NaN values in frame calculations cause the expandFrameWithSize method to fail catastrophically.</p>';
            
            nanFrames.forEach((frame, index) => {
                const context = this.getFrameContext(frameChanges, frame);
                html += this.createResultItem(`
                    <strong>NaN Event #${index + 1}</strong><br>
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.frameType})<br>
                    <small>Previous frame: ${context.previous || 'N/A'} | Next frame: ${context.next || 'N/A'}</small>
                `, 'critical');
            });
        }

        // Zero Dimension Analysis
        if (zeroFrames.length > 0) {
            html += '<h4>⚠️ Zero-Dimension Issues</h4>';
            html += '<p>Zero dimensions often trigger mathematical operations that result in NaN values.</p>';
            
            zeroFrames.slice(0, 5).forEach(frame => {
                const progression = this.calculateFrameProgression(frameChanges, frame);
                html += this.createResultItem(`
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.frameType})<br>
                    <small>Frame progression: ${progression}</small>
                `, 'warning');
            });
            
            if (zeroFrames.length > 5) {
                html += this.createResultItem(`... and ${zeroFrames.length - 5} more zero-dimension events`, 'warning');
            }
        }

        // Other Anomalies
        if (negativeFrames.length > 0) {
            html += '<h4>⚠️ Negative Frame Dimensions</h4>';
            negativeFrames.forEach(frame => {
                html += this.createResultItem(`
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.frameType})
                `, 'warning');
            });
        }

        if (extremeFrames.length > 0) {
            html += '<h4>⚠️ Extreme Frame Sizes</h4>';
            extremeFrames.forEach(frame => {
                html += this.createResultItem(`
                    Line ${frame.line}: ${frame.width.toFixed(1)} x ${frame.height.toFixed(1)} (${frame.frameType})
                `, 'warning');
            });
        }

        // Frame Evolution Timeline
        html += '<h4>📈 Frame Evolution Timeline</h4>';
        html += '<p>Showing the progression of frame changes leading to the crash:</p>';
        
        const timelineFrames = frameChanges.slice(-15); // Show last 15 for better context
        timelineFrames.forEach((frame, index) => {
            const type = (isNaN(frame.width) || isNaN(frame.height)) ? 'critical' : 
                        (frame.width === 0 || frame.height === 0) ? 'warning' : 'normal';
            
            const aspectRatio = frame.height !== 0 ? (frame.width / frame.height).toFixed(3) : 'inf';
            const area = isNaN(frame.width * frame.height) ? 'NaN' : (frame.width * frame.height).toFixed(1);
            
            html += this.createResultItem(`
                <strong>Step ${timelineFrames.length - index}</strong> - Line ${frame.line}:<br>
                Dimensions: ${isNaN(frame.width) ? 'NaN' : frame.width.toFixed(1)} x ${isNaN(frame.height) ? 'NaN' : frame.height.toFixed(1)} (${frame.frameType})<br>
                <small>Aspect ratio: ${aspectRatio} | Area: ${area} | Time: ${frame.timestamp}</small>
            `, type);
        });

        return html;
    }

    getFrameContext(frameChanges, targetFrame) {
        const index = frameChanges.findIndex(f => f.line === targetFrame.line);
        const previous = index > 0 ? 
            `${frameChanges[index-1].width.toFixed(1)}x${frameChanges[index-1].height.toFixed(1)}` : null;
        const next = index < frameChanges.length - 1 ? 
            `${frameChanges[index+1].width.toFixed(1)}x${frameChanges[index+1].height.toFixed(1)}` : null;
        
        return { previous, next };
    }

    calculateFrameProgression(frameChanges, targetFrame) {
        const index = frameChanges.findIndex(f => f.line === targetFrame.line);
        if (index < 2) return 'Insufficient data';
        
        const frames = frameChanges.slice(Math.max(0, index - 2), index + 1);
        return frames.map(f => `${f.width.toFixed(0)}x${f.height.toFixed(0)}`).join(' → ');
    }

    analyzeRenderSizes(renderSizes) {
        if (renderSizes.length === 0) {
            return '<p>No render size data found in this log.</p>';
        }

        const zeroRenders = renderSizes.filter(r => r.width === 0 || r.height === 0);
        const nanRenders = renderSizes.filter(r => isNaN(r.ratio));
        const extremeRatios = renderSizes.filter(r => r.ratio > 100 || (r.ratio < 0.01 && r.ratio > 0));

        let html = '';

        // Critical render issues
        if (zeroRenders.length > 0) {
            html += '<h4>🚨 CRITICAL: Zero Render Dimensions</h4>';
            html += '<p>Zero render sizes are a primary trigger for NaN frame calculations.</p>';
            
            zeroRenders.forEach((render, index) => {
                html += this.createResultItem(`
                    <strong>Zero Render #${index + 1}</strong><br>
                    Line ${render.line}: ${render.width} x ${render.height}<br>
                    <small>Ratio: ${render.ratio === Infinity ? 'infinity' : render.ratio} | Time: ${render.timestamp}</small>
                `, 'critical');
            });
        }

        // Extreme ratios
        if (extremeRatios.length > 0) {
            html += '<h4>⚠️ Extreme Aspect Ratios</h4>';
            extremeRatios.slice(0, 5).forEach(render => {
                html += this.createResultItem(`
                    Line ${render.line}: ${render.width} x ${render.height} (ratio: ${render.ratio.toFixed(6)})
                `, 'warning');
            });
        }

        // Render size progression
        html += '<h4>📊 Render Size Progression</h4>';
        const recentRenders = renderSizes.slice(-10);
        recentRenders.forEach((render, index) => {
            const type = (render.width === 0 || render.height === 0) ? 'critical' : 
                        (render.ratio > 100 || render.ratio < 0.01) ? 'warning' : 'normal';
            
            html += this.createResultItem(`
                Step ${recentRenders.length - index} - Line ${render.line}:<br>
                ${render.width} x ${render.height} (ratio: ${render.ratio === Infinity ? 'inf' : render.ratio.toFixed(6)})
            `, type);
        });

        return html;
    }

    performComprehensiveCrashAnalysis(data) {
        const analysis = {
            hasCrash: false,
            severity: 'normal',
            primaryCause: null,
            triggerEvents: [],
            cascadePattern: [],
            recommendations: []
        };

        // Check for NaN values (primary crash indicator)
        const nanFrames = data.frameChanges.filter(f => isNaN(f.width) || isNaN(f.height));
        if (nanFrames.length > 0) {
            analysis.hasCrash = true;
            analysis.severity = 'critical';
            analysis.primaryCause = 'NaN values in frame calculations';
            analysis.triggerEvents.push(`${nanFrames.length} NaN frame events detected`);
        }

        // Check for zero render sizes (common trigger)
        const zeroRenders = data.renderSizes.filter(r => r.width === 0 || r.height === 0);
        if (zeroRenders.length > 0) {
            analysis.triggerEvents.push(`${zeroRenders.length} zero render size events`);
            if (!analysis.hasCrash) {
                analysis.severity = 'warning';
            }
        }

        // Analyze cascade pattern
        if (analysis.hasCrash) {
            analysis.cascadePattern = this.traceCrashCascade(data, nanFrames[0]);
        }

        // Generate recommendations
        analysis.recommendations = this.generateCrashRecommendations(analysis, data);

        return analysis;
    }

    traceCrashCascade(data, firstNanFrame) {
        const cascade = [];
        const nanLineNumber = firstNanFrame.line;

        // Find events leading up to the crash
        const preEvents = [
            ...data.renderSizes.filter(r => r.line < nanLineNumber).slice(-3),
            ...data.frameChanges.filter(f => f.line < nanLineNumber).slice(-3)
        ].sort((a, b) => a.line - b.line);

        cascade.push({
            phase: 'Pre-crash Events',
            events: preEvents.map(e => `Line ${e.line}: ${e.type || 'render'} ${e.width}x${e.height}`)
        });

        cascade.push({
            phase: 'Crash Event',
            events: [`Line ${nanLineNumber}: NaN frame values detected`]
        });

        return cascade;
    }

    assessCrashSeverity(data) {
        const nanFrames = data.frameChanges.filter(f => isNaN(f.width) || isNaN(f.height));
        const zeroRenders = data.renderSizes.filter(r => r.width === 0 || r.height === 0);
        const zeroFrames = data.frameChanges.filter(f => f.width === 0 || f.height === 0);

        if (nanFrames.length > 0) return 'critical';
        if (zeroRenders.length > 2 || zeroFrames.length > 2) return 'warning';
        return 'normal';
    }

    createCrashAnalysisSection(crashAnalysis) {
        let html = `
            <div class="analysis-section">
                <h2>🚨 CRASH ANALYSIS - ${crashAnalysis.severity.toUpperCase()} SEVERITY</h2>
                <div style="background: ${crashAnalysis.severity === 'critical' ? '#ffe6e6' : '#fff9e6'}; border: 1px solid ${crashAnalysis.severity === 'critical' ? '#dc3545' : '#ffc107'}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        `;

        if (crashAnalysis.primaryCause) {
            html += `<p><strong>🎯 Primary Cause:</strong> ${crashAnalysis.primaryCause}</p>`;
        }

        if (crashAnalysis.triggerEvents.length > 0) {
            html += `<p><strong>⚡ Trigger Events:</strong></p><ul>`;
            crashAnalysis.triggerEvents.forEach(event => {
                html += `<li>${event}</li>`;
            });
            html += `</ul>`;
        }

        if (crashAnalysis.cascadePattern.length > 0) {
            html += `<p><strong>📈 Crash Cascade Pattern:</strong></p>`;
            crashAnalysis.cascadePattern.forEach(phase => {
                html += `<div style="margin: 10px 0;"><strong>${phase.phase}:</strong><ul>`;
                phase.events.forEach(event => {
                    html += `<li><code>${event}</code></li>`;
                });
                html += `</ul></div>`;
            });
        }

        html += `</div></div>`;
        return html;
    }

    generateStatisticalSummary(data) {
        const stats = {
            totalFrameChanges: data.frameChanges.length,
            totalRenderSizes: data.renderSizes.length,
            totalLetterSpacing: data.letterSpacingEvents.length,
            totalLineSpacing: data.lineSpacingEvents.length,
            totalRenderTasks: data.renderTasks.length,
            totalEvents: data.allEvents.length,
            nanCount: data.frameChanges.filter(f => isNaN(f.width) || isNaN(f.height)).length,
            zeroCount: data.frameChanges.filter(f => f.width === 0 || f.height === 0).length,
            averageFrameSize: null,
            frameRange: null
        };

        if (data.frameChanges.length > 0) {
            const validFrames = data.frameChanges.filter(f => !isNaN(f.width) && !isNaN(f.height) && f.width > 0 && f.height > 0);
            if (validFrames.length > 0) {
                const avgWidth = validFrames.reduce((sum, f) => sum + f.width, 0) / validFrames.length;
                const avgHeight = validFrames.reduce((sum, f) => sum + f.height, 0) / validFrames.length;
                stats.averageFrameSize = `${avgWidth.toFixed(1)} x ${avgHeight.toFixed(1)}`;

                const minWidth = Math.min(...validFrames.map(f => f.width));
                const maxWidth = Math.max(...validFrames.map(f => f.width));
                const minHeight = Math.min(...validFrames.map(f => f.height));
                const maxHeight = Math.max(...validFrames.map(f => f.height));
                stats.frameRange = `${minWidth.toFixed(1)}-${maxWidth.toFixed(1)} x ${minHeight.toFixed(1)}-${maxHeight.toFixed(1)}`;
            }
        }

        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Total Events</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalEvents}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Frame Events</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalFrameChanges}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Letter Spacing</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalLetterSpacing}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Line Spacing</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalLineSpacing}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>NaN Incidents</h4>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${stats.nanCount > 0 ? '#dc3545' : '#28a745'};">${stats.nanCount}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Zero Dimensions</h4>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${stats.zeroCount > 0 ? '#ffc107' : '#28a745'};">${stats.zeroCount}</div>
                </div>
            </div>
        `;

        if (stats.averageFrameSize) {
            html += `<p><strong>Average Frame Size:</strong> ${stats.averageFrameSize}</p>`;
        }
        if (stats.frameRange) {
            html += `<p><strong>Frame Size Range:</strong> ${stats.frameRange}</p>`;
        }

        return html;
    }

    generateRecommendations(crashAnalysis, data) {
        const recommendations = [];

        if (crashAnalysis.severity === 'critical') {
            recommendations.push({
                priority: 'HIGH',
                title: 'Immediate Fix Required',
                description: 'Add NaN validation before all frame calculations in expandFrameWithSize method',
                code: 'if (isnan(width) || isnan(height)) { /* fallback logic */ }'
            });
        }

        const zeroRenders = data.renderSizes.filter(r => r.width === 0 || r.height === 0);
        if (zeroRenders.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                title: 'Prevent Zero Render Sizes',
                description: 'Add validation to prevent zero render dimensions that trigger NaN calculations',
                code: 'if (renderSize.width <= 0 || renderSize.height <= 0) { /* use minimum viable size */ }'
            });
        }

        // Letter spacing recommendations
        const nanLetterSpacing = data.letterSpacingEvents.filter(e => isNaN(e.newValue) || isNaN(e.currentValue));
        if (nanLetterSpacing.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                title: 'Fix Letter Spacing NaN Values',
                description: 'Validate letter spacing values before applying them to prevent NaN propagation',
                code: 'if (isnan(letterSpacing)) { letterSpacing = defaultLetterSpacing; }'
            });
        }

        // Line spacing recommendations
        const nanLineSpacing = data.lineSpacingEvents.filter(e => isNaN(e.newValue) || isNaN(e.currentValue));
        if (nanLineSpacing.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                title: 'Fix Line Spacing NaN Values',
                description: 'Validate line spacing values before applying them to prevent NaN propagation',
                code: 'if (isnan(lineSpacing)) { lineSpacing = defaultLineSpacing; }'
            });
        }

        // Excessive spacing changes
        const excessiveLetterChanges = data.letterSpacingEvents.filter(e => e.changed && Math.abs(e.delta) > 10);
        const excessiveLineChanges = data.lineSpacingEvents.filter(e => e.changed && Math.abs(e.delta) > 10);
        if (excessiveLetterChanges.length > 0 || excessiveLineChanges.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                title: 'Limit Spacing Change Magnitude',
                description: 'Implement bounds checking for spacing changes to prevent extreme values',
                code: 'const boundedSpacing = Math.max(minSpacing, Math.min(maxSpacing, newSpacing));'
            });
        }

        if (data.textStyleGuids.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                title: 'Text Style Validation',
                description: 'Validate text style parameters before applying them to prevent invalid frame calculations',
                code: 'validateTextStyleBeforeApply(textStyle);'
            });
        }

        recommendations.push({
            priority: 'MEDIUM',
            title: 'Add Defensive Programming',
            description: 'Implement bounds checking and fallback values for all frame calculations',
            code: 'const safeWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));'
        });

        let html = '';
        recommendations.forEach((rec, index) => {
            const priorityColor = rec.priority === 'HIGH' ? '#dc3545' : rec.priority === 'MEDIUM' ? '#ffc107' : '#28a745';
            html += `
                <div style="border-left: 4px solid ${priorityColor}; background: white; padding: 15px; margin-bottom: 15px; border-radius: 6px;">
                    <h4 style="margin: 0 0 10px 0; color: ${priorityColor};">${rec.priority} PRIORITY: ${rec.title}</h4>
                    <p style="margin: 10px 0;">${rec.description}</p>
                    <code style="background: #f8f9fa; padding: 5px; border-radius: 3px; display: block; margin-top: 10px;">${rec.code}</code>
                </div>
            `;
        });

        return html;
    }

    generateCrashRecommendations(analysis, data) {
        // Implementation for generating specific recommendations based on crash analysis
        return analysis.recommendations || [];
    }
}
