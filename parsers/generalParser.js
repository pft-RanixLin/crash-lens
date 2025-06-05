import { BaseParser } from "./parserRegistry.js";

export default class GeneralParser extends BaseParser {
    constructor() {
        super();
        this.id = "general";
        this.name = "General Parser";
        this.description = "Comprehensive analysis for all crash types";
        this.targetCrashEvent = "All Crash Types";
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
        containers.summaryContainer.innerHTML = this.createSummaryCard("General Parser", "Active");
        containers.contentContainer.innerHTML = this.createAnalysisSection("General Analysis", "<p>General parser implementation coming soon.</p>");
    }
}
