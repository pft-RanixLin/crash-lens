import { BaseParser } from "./parserRegistry.js";

export default class SpacingParser extends BaseParser {
    constructor() {
        super();
        this.id = "spacing";
        this.name = "Spacing Parser";
        this.description = "Analyzes spacing changes";
        this.targetCrashEvent = "Spacing Issues";
    }

    async parse(logContent) {
        return {
            textStyleGuids: [],
            frameChanges: [],
            renderSizes: [],
            spacingChanges: []
        };
    }

    async displayResults(data, containers) {
        // Hide Firebase link for spacing-specific parser
        if (containers.hideFirebaseLink) {
            containers.hideFirebaseLink();
        }
        
        containers.summaryContainer.innerHTML = this.createSummaryCard("Spacing Parser", "Active");
        containers.contentContainer.innerHTML = this.createAnalysisSection("Spacing Analysis", "<p>Spacing parser implementation coming soon.</p>");
    }
}
