
import { TypescriptExtractor, TypescriptExtractorSettings } from "@ts-docs/extractor";
import { TsDocsReferenceManager } from "./ReferenceManager";

export class TsDocsTypescriptExtractor extends TypescriptExtractor {
    constructor(settings: TypescriptExtractorSettings) {
        super(settings);
        this.refs = new TsDocsReferenceManager(settings.externals);
    }
}

export * from "@ts-docs/extractor";