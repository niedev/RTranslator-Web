import { LatencyOptimisedTranslator, type LanguagePair, type TranslationModel, type TranslatorOptions, type TranslationResponse } from "@browsermt/bergamot-translator/translator.js";
import { LanguageResourceManager } from "@src/translator/LanguageResourceManager"

export class Translator {
    private translator: LatencyOptimisedTranslator;
    private languageResourcesManager: LanguageResourceManager;
    private translateTask: { controller: AbortController, promise: Promise<TranslationResponse> } | null;
    private loadLanguagesTask: { controller: AbortController, promise: Promise<void> } | null;


    constructor() {
        const options: TranslatorOptions = {
            cacheSize: 2000,
            pivotLanguage: "en",
            downloadTimeout: 0,   // irrelevant: our backing never uses fetch()
            /**onerror: (err: Error) => {  //todo: implement error handling (now it is broken)
                console.log(err.stack);
            },**/
        };
        this.languageResourcesManager = new LanguageResourceManager(options);
        this.translator = new LatencyOptimisedTranslator(options, this.languageResourcesManager);
        this.translateTask = null;
        this.loadLanguagesTask = null;
    }

    async translate(text: string, from: string, to: string): Promise<string> {
        if (from === to) return Promise.resolve(text);  //if the source and target languages are the same, we return the input text as a result immediately

        if(this.loadLanguagesTask != null) {
            await this.loadLanguagesTask.promise;   //if a loadLanguagesTask is running we wait for it to finish before starting the translation
        }

        let abortController = new AbortController();

        const promise = this.translator.translate(
            { from, to, text, html: false, qualityScores: false }, { signal: abortController.signal }
        );

        this.translateTask = { controller: abortController, promise: promise };

        const response = await promise;

        this.translateTask = null;  //the task is finished, so we remove its abortController
        return response.target.text;
    }

    async loadLanguagePairResources(srcLang: string, tgtLang: string): Promise<void> {
        // we eventually interrupt the previous loadLanguagePairResources and translate tasks and wait their catch of the abort.
        if (this.loadLanguagesTask) {
            this.loadLanguagesTask.controller.abort();  //we interrupt the previous loadLanguagePairResources if it's still running
            // Wait for the loadLanguagePairResources task to catch the abort.
            try {
                await this.loadLanguagesTask.promise;
            } catch (e) {
                // Ignore the expected AbortError thrown by the cancelled task
            }
            this.loadLanguagesTask = null;  //the task is canceled, so we remove its abortController
        }
        if (this.translateTask) {
            this.translateTask.controller.abort();  //we interrupt the translate if it's still running
            // Wait for the translate task to catch the abort.
            try {
                await this.translateTask.promise;
            } catch (e) {
                // Ignore the expected AbortError thrown by the cancelled task
            }
            this.translateTask = null;  //the task is canceled, so we remove its abortController
        }

        // we start the loading of the language pair resources
        let abortController = new AbortController();

        const promise = this.performLoadLanguagePairResources(srcLang, tgtLang, abortController.signal);

        this.loadLanguagesTask = { controller: abortController, promise: promise };
        return promise;
    }

    private async performLoadLanguagePairResources (srcLang: string, tgtLang: string, signal: AbortSignal) : Promise<void> {
        let worker = await this.translator.worker;
        // we eventually remove the old models (we remove all the models that aren't use for this new language pair)
        for (let key of this.languageResourcesManager.buffers.keys()) {
            let langs: LanguagePair = JSON.parse(key);
            if ((srcLang != "en" && langs.from != srcLang && langs.to != srcLang) && (tgtLang != "en" && langs.from != tgtLang && langs.to != tgtLang)) {
                // old model remove for the languageResourcesManager worker  (wasm)
                await worker.exports.freeTranslationModel(langs);
                signal.throwIfAborted();
                // old model remove for languageResourcesManager  (js)
                this.languageResourcesManager.loadModelsAbortControllers.get(key)?.abort();   // eventual interrupt the loading processes connected to the promise we will remove
                // Wait for the loading processes connected to the promise task to catch the abort.
                try {
                    await this.languageResourcesManager.buffers.get(key);
                } catch (e) {
                    // Ignore the expected AbortError thrown by the cancelled task
                }
                this.languageResourcesManager.buffers.delete(key);
                signal.throwIfAborted();
            }
        }
        // we load the new models  (sequential on purpose: two allocations at once spikes the wasm heap)
        let pairs = [{ from: srcLang, to: "en" }, { from: "en", to: srcLang }, { from: tgtLang, to: "en" }, { from: "en", to: tgtLang }]
        let model: TranslationModel;
        for (let pair of pairs) {
            if (pair.to == "en" && pair.from == "en") continue;  //if the srcLang or tgtLang (or both) are "en", we skip the load
            // load for languageResourcesManager  (js)
            model = await this.languageResourcesManager.getTranslationModel(pair);  //we do not pass the loadLanguagesAbortController here because an internal interruption, without deletion of the buffer can cause problems, so we interrupt this operation only above, in the removal of unused models
            signal.throwIfAborted();
            // load for the languageResourcesManager worker  (wasm)
            if (!await worker.exports.hasTranslationModel(pair)) await worker.exports.loadTranslationModel(pair, model);
            signal.throwIfAborted();
        }
        this.loadLanguagesTask = null;   //the task is finished, so we remove its abortController
    }

    /**
     * This method will update the registery attribute of languageResourcesManager, by adding the info of a new downloaded model, without reloading the entire registery with loadModelRegistery.
     */
    async addModelToRegistery(lang: string): Promise<void> {
        return this.languageResourcesManager.addModelToRegistery(lang);
    }

    /**
     * This method will update the registery attribute of languageResourcesManager, by removing the info of a deleted downloaded model, without reloading the entire registery with loadModelRegistery.
     */
    async removeModelFromRegistery(lang: string): Promise<void> {
        if (lang != "en") {
            return this.languageResourcesManager.removeModelFromRegistery(lang);
        }
    }
}