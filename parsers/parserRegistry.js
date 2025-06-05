/**
 * Parser Registry - Manages all available crash log parsers
 */

// Available parser modules
const PARSER_MODULES = [
    './expandFrameParser.js',
    './spacingParser.js', 
    './generalParser.js'
];

/**
 * Load all available parsers dynamically
 */
export async function loadParsers() {
    const parsers = {};
    
    for (const modulePath of PARSER_MODULES) {
        try {
            const module = await import(modulePath);
            const parser = new module.default();
            parsers[parser.id] = parser;
            console.log(`Loaded parser: ${parser.name} v${parser.version}`);
        } catch (error) {
            console.warn(`Failed to load parser ${modulePath}:`, error);
        }
    }
    
    return parsers;
}

/**
 * Base Parser Class - All parsers should extend this
 */
export class BaseParser {
    constructor() {
        this.id = 'base';
        this.name = 'Base Parser';
        this.version = '1.0.0';
        this.description = 'Base parser class';
        this.targetCrashEvent = 'General';
    }

    async parse(logContent) {
        throw new Error('Parse method must be implemented by subclass');
    }

    async displayResults(data, containers) {
        throw new Error('DisplayResults method must be implemented by subclass');
    }

    createSummaryCard(title, value, className = '') {
        return `
            <div class="summary-card ${className}">
                <h3>${title}</h3>
                <div class="value">${value}</div>
            </div>
        `;
    }

    createAnalysisSection(title, content) {
        return `
            <div class="analysis-section">
                <h2>${title}</h2>
                <div class="results-content">
                    ${content}
                </div>
            </div>
        `;
    }

    createResultItem(content, type = 'normal') {
        return `
            <div class="result-item ${type}" style="
                padding: 10px; 
                margin-bottom: 10px; 
                background: white; 
                border-radius: 6px; 
                border-left: 4px solid ${type === 'critical' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
                ${type === 'critical' ? 'background: #ffe6e6;' : type === 'warning' ? 'background: #fff9e6;' : ''}
            ">
                ${content}
            </div>
        `;
    }

    parseLogLine(line) {
        const timestampMatch = line.match(/(\d+) \| (.*?) \| (.*)/);
        if (!timestampMatch) return null;

        return {
            lineNumber: parseInt(timestampMatch[1]),
            timestamp: timestampMatch[2],
            content: timestampMatch[3]
        };
    }
}
