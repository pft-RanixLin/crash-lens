# YouPerfect Crash Log Analyzer

A modular web-based crash log analyzer with extensible parser architecture for different crash types.

## 🚀 Quick Start

1. Run `initServer.command` to start the local Python server
2. Open your browser and go to `http://[::]:52782/`
3. Upload your crash log file (`.log` or `.txt`)
4. Select the appropriate parser for your crash type
5. Click "Analyze Log File" to get comprehensive crash analysis

## 📋 Available Parsers

- **ExpandFrame Crash Parser**: Specialized for `TextBubbleStickerView expandFrameWithSize:` crashes
- **Spacing Parser**: For spacing-related issues (template)
- **General Parser**: Comprehensive analysis for all crash types (template)

## 🛠 Developer Guide: Adding New Parsers

### Parser Architecture Overview

The system uses a modular parser architecture where each parser:
- Extends the `BaseParser` class
- Implements crash-specific parsing logic
- Provides custom display methods
- Can optionally integrate with Firebase Crashlytics

### Step 1: Create Your Parser File

Create a new file in the `parsers/` directory following this naming convention:
```
parsers/yourCrashTypeParser.js
```

### Step 2: Basic Parser Template

```javascript
import { BaseParser } from './parserRegistry.js';

export default class YourCrashTypeParser extends BaseParser {
    constructor() {
        super();
        this.id = 'yourCrashType';           // Unique identifier
        this.name = 'Your Crash Type Parser'; // Display name
        this.version = '1.0.0';              // Parser version
        this.description = 'Description of what this parser analyzes';
        this.targetCrashEvent = 'Specific crash method or event';
    }

    async parse(logContent) {
        // Parse the log content and extract relevant data
        const lines = logContent.split('\n');
        const data = {
            // Define your data structure
            crashes: [],
            events: [],
            errors: []
        };

        // Your parsing logic here
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parsed = this.parseLogLine(line); // Helper from BaseParser
            
            if (!parsed) continue;
            
            // Extract crash-specific information
            // Add to data structure
        }

        return data;
    }

    async displayResults(data, containers) {
        // Control Firebase link visibility
        if (containers.hideFirebaseLink) {
            containers.hideFirebaseLink(); // Hide if not relevant
        }
        // OR
        if (containers.showFirebaseLink) {
            containers.showFirebaseLink('https://your-custom-firebase-url.com');
        }

        // Create summary cards
        const summaryHTML = [
            this.createSummaryCard('Crash Count', data.crashes.length),
            this.createSummaryCard('Events', data.events.length),
            this.createSummaryCard('Errors', data.errors.length)
        ].join('');

        containers.summaryContainer.innerHTML = summaryHTML;

        // Create detailed analysis sections
        let contentHTML = '';
        contentHTML += this.createAnalysisSection('🔍 Crash Analysis', this.analyzeCrashes(data.crashes));
        contentHTML += this.createAnalysisSection('📊 Event Timeline', this.analyzeEvents(data.events));
        contentHTML += this.createAnalysisSection('💡 Recommendations', this.generateRecommendations(data));

        containers.contentContainer.innerHTML = contentHTML;
    }

    // Custom analysis methods
    analyzeCrashes(crashes) {
        if (crashes.length === 0) {
            return '<p>⚠️ No crashes detected in this log.</p>';
        }

        let html = '<h4>Detected Crashes:</h4>';
        crashes.forEach(crash => {
            html += this.createResultItem(`
                <strong>Line ${crash.line}</strong>: ${crash.description}<br>
                <small>Time: ${crash.timestamp}</small>
            `);
        });

        return html;
    }

    analyzeEvents(events) {
        // Your event analysis logic
        return '<p>Event analysis implementation here.</p>';
    }

    generateRecommendations(data) {
        // Your recommendation logic
        return '<p>Recommendations based on analysis.</p>';
    }
}
```

### Step 3: Register Your Parser

Add your parser to `parsers/parserRegistry.js`:

```javascript
// Import your parser
import YourCrashTypeParser from './yourCrashTypeParser.js';

// Add to the parsers object in loadParsers()
export async function loadParsers() {
    const parsers = {};
    
    try {
        // Existing parsers...
        
        // Add your parser
        const yourParser = new YourCrashTypeParser();
        parsers[yourParser.id] = yourParser;
        
    } catch (error) {
        console.error('Error loading parsers:', error);
    }
    
    return parsers;
}
```

### Step 4: BaseParser Helper Methods

The `BaseParser` class provides useful helper methods:

#### Parsing Helpers
```javascript
// Parse log line with format: "line_number | timestamp | content"
const parsed = this.parseLogLine(line);
// Returns: { lineNumber, timestamp, content } or null

// Parse action blocks
// Handles Action:{ ... } blocks with key-value pairs
```

#### Display Helpers
```javascript
// Create summary cards
this.createSummaryCard(title, value, cssClass = '')

// Create analysis sections
this.createAnalysisSection(title, content)

// Create result items
this.createResultItem(content)
```

### Step 5: Firebase Integration (Optional)

If your parser should link to a specific Firebase Crashlytics page:

```javascript
async displayResults(data, containers) {
    // Show Firebase link with custom URL
    if (containers.showFirebaseLink) {
        containers.showFirebaseLink('https://console.firebase.google.com/your-specific-url');
    }
    
    // Rest of your display logic...
}
```

To add the Firebase link to the parser selection:
1. Edit `index.html`
2. Find the `displayParserOptions()` function
3. Add your parser ID to the Firebase link condition:

```javascript
const firebaseLink = (id === 'expandFrame' || id === 'yourCrashType') ? 
    `<div class="parser-firebase-link">...` : '';
```

### Step 6: Advanced Features

#### Log Line Parsing
```javascript
// Custom regex patterns for your crash type
const crashPattern = /your-crash-pattern-here/;
const match = content.match(crashPattern);

if (match) {
    // Extract specific data from the match
    const crashData = {
        line: lineNumber,
        timestamp: timestamp,
        value: match[1],
        // etc.
    };
}
```

#### Multi-line Block Parsing
```javascript
let inSpecialBlock = false;
let currentBlockData = {};

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'SpecialBlock:{') {
        inSpecialBlock = true;
        currentBlockData = {};
        continue;
    }
    
    if (inSpecialBlock) {
        if (line === '}') {
            // Process completed block
            data.specialBlocks.push(currentBlockData);
            inSpecialBlock = false;
            currentBlockData = {};
        } else if (line.includes(':')) {
            // Parse key-value pairs
            const [key, value] = line.split(':', 2);
            currentBlockData[key.trim()] = value.trim();
        }
    }
}
```

#### Statistical Analysis
```javascript
generateStatisticalSummary(data) {
    const stats = {
        total: data.items.length,
        unique: new Set(data.items.map(item => item.type)).size,
        average: data.items.reduce((sum, item) => sum + item.value, 0) / data.items.length
    };
    
    return `
        <div class="stats-grid">
            <div class="stat-item">
                <strong>Total:</strong> ${stats.total}
            </div>
            <div class="stat-item">
                <strong>Unique Types:</strong> ${stats.unique}
            </div>
            <div class="stat-item">
                <strong>Average:</strong> ${stats.average.toFixed(2)}
            </div>
        </div>
    `;
}
```

## 🎨 Styling Guidelines

Use these CSS classes for consistent styling:

- `.summary-card` - Summary information cards
- `.analysis-section` - Main analysis sections
- `.results-content` - Content containers
- `.critical-card` - Critical severity styling (red)
- `.warning-card` - Warning severity styling (yellow)

## 📝 Best Practices

1. **Error Handling**: Always handle cases where no relevant data is found
2. **Performance**: For large logs, consider chunking or streaming
3. **User Feedback**: Provide clear, actionable insights
4. **Consistency**: Follow the existing parser patterns
5. **Documentation**: Comment complex parsing logic
6. **Testing**: Test with various log formats and edge cases

## 🔧 Example Use Cases

- **Memory Crash Parser**: Analyze memory allocation failures
- **Network Error Parser**: Parse network-related crashes
- **UI Layout Parser**: Analyze layout constraint failures
- **Threading Parser**: Detect threading and synchronization issues
- **Database Parser**: Analyze Core Data or SQLite errors

## 📚 File Structure

```
/
├── index.html                    # Main application
├── README.md                     # This file
└── parsers/
    ├── parserRegistry.js         # Parser management system
    ├── expandFrameParser.js      # ExpandFrame crash parser
    ├── spacingParser.js          # Spacing parser (template)
    ├── generalParser.js          # General parser (template)
    └── yourNewParser.js          # Your custom parser
```

## 🤝 Contributing

1. Create your parser following the template above
2. Test thoroughly with sample logs
3. Update this README if adding new patterns or features
4. Ensure Firebase integration works correctly if applicable

## 🐛 Troubleshooting

- **Parser not loading**: Check console for import errors
- **No results**: Verify your parsing logic with console.log()
- **Display issues**: Check HTML structure and CSS classes
- **Firebase link not working**: Verify URL format and parser registration

---

Happy parsing! 🎉 