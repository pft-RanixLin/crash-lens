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
            spacingChanges: []
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
                        data.textStyleGuids.push({
                            line: actionStartLine,
                            timestamp: actionTimestamp,
                            guid: currentActionData.text_style_guid,
                            operation: currentActionData.operation || '',
                            feature_name: currentActionData.feature_name || '',
                            text_category: currentActionData.text_category || ''
                        });
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

            if (content.includes('expandFrameWithSize:') || content.includes('expandFrameSize:')) {
                const frameSizeMatch = content.match(/size=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (frameSizeMatch) {
                    const width = parseFloat(frameSizeMatch[1]);
                    const height = parseFloat(frameSizeMatch[2]);
                    data.frameChanges.push({
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'expand',
                        width: width,
                        height: height
                    });
                }

                const currentFrameMatch = content.match(/current frameSize=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (currentFrameMatch) {
                    const width = parseFloat(currentFrameMatch[1]);
                    const height = parseFloat(currentFrameMatch[2]);
                    data.frameChanges.push({
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'current',
                        width: width,
                        height: height
                    });
                }

                const newFrameMatch = content.match(/newFrame=\{\{[0-9., ]+\},\s*\{([0-9.-]+),\s*([0-9.-]+)\}\}/);
                if (newFrameMatch) {
                    const width = parseFloat(newFrameMatch[1]);
                    const height = parseFloat(newFrameMatch[2]);
                    data.frameChanges.push({
                        line: lineNumber,
                        timestamp: timestamp,
                        type: 'new',
                        width: width,
                        height: height
                    });
                }
            }

            if (content.includes('renderSize=')) {
                const renderMatch = content.match(/renderSize=\{([0-9.-]+),\s*([0-9.-]+)\}/);
                if (renderMatch) {
                    const width = parseFloat(renderMatch[1]);
                    const height = parseFloat(renderMatch[2]);
                    const ratio = height !== 0 ? width / height : Infinity;
                    data.renderSizes.push({
                        line: lineNumber,
                        timestamp: timestamp,
                        width: width,
                        height: height,
                        ratio: ratio
                    });
                }
            }
        }

        return data;
    }

    async displayResults(data, containers) {
        // Enhanced analysis
        const crashAnalysis = this.performComprehensiveCrashAnalysis(data);
        const severity = this.assessCrashSeverity(data);
        

        
        const summaryHTML = [
            this.createSummaryCard('Text Style GUIDs', data.textStyleGuids.length),
            this.createSummaryCard('Frame Changes', data.frameChanges.length, severity === 'critical' ? 'critical-card' : ''),
            this.createSummaryCard('Render Sizes', data.renderSizes.length),
            this.createSummaryCard('Crash Severity', severity.toUpperCase(), severity === 'critical' ? 'critical-card' : severity === 'warning' ? 'warning-card' : '')
        ].join('');

        containers.summaryContainer.innerHTML = summaryHTML;

        let contentHTML = '';
        
        // Crash Analysis First (most important)
        if (crashAnalysis.hasCrash) {
            contentHTML += this.createCrashAnalysisSection(crashAnalysis);
        }
        
        contentHTML += this.createAnalysisSection('📋 Text Style GUID Analysis', this.analyzeGuids(data.textStyleGuids));
        contentHTML += this.createAnalysisSection('📐 Frame Size Evolution & Critical Analysis', this.analyzeFrameChangesComprehensive(data.frameChanges, data.renderSizes));
        contentHTML += this.createAnalysisSection('🔍 Render Size Diagnostics', this.analyzeRenderSizes(data.renderSizes));
        contentHTML += this.createAnalysisSection('📊 Statistical Summary', this.generateStatisticalSummary(data));
        contentHTML += this.createAnalysisSection('💡 Recommendations', this.generateRecommendations(crashAnalysis, data));

        containers.contentContainer.innerHTML = contentHTML;
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
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.type})<br>
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
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.type})<br>
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
                    Line ${frame.line}: ${frame.width} x ${frame.height} (${frame.type})
                `, 'warning');
            });
        }

        if (extremeFrames.length > 0) {
            html += '<h4>⚠️ Extreme Frame Sizes</h4>';
            extremeFrames.forEach(frame => {
                html += this.createResultItem(`
                    Line ${frame.line}: ${frame.width.toFixed(1)} x ${frame.height.toFixed(1)} (${frame.type})
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
                Dimensions: ${isNaN(frame.width) ? 'NaN' : frame.width.toFixed(1)} x ${isNaN(frame.height) ? 'NaN' : frame.height.toFixed(1)} (${frame.type})<br>
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
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Frame Events</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalFrameChanges}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>NaN Incidents</h4>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${stats.nanCount > 0 ? '#dc3545' : '#28a745'};">${stats.nanCount}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Zero Dimensions</h4>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${stats.zeroCount > 0 ? '#ffc107' : '#28a745'};">${stats.zeroCount}</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>Render Events</h4>
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.totalRenderSizes}</div>
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
