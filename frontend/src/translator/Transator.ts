import { LatencyOptimisedTranslator, type LanguagePair, type TranslationModel, type TranslatorOptions, type TranslationResponse } from "@browsermt/bergamot-translator/translator.js";
import { LanguageResourceManager } from "@src/translator/LanguageResourceManager"

type Kind = "translate" | "load";

export class Translator {
    private translator: LatencyOptimisedTranslator;
    private languageResourcesManager: LanguageResourceManager;
    /**
     * It's a promise representing the tail of the queue — the last operation that was scheduled.
     * Each new task attaches itself with .then(), which means it starts only after everything scheduled before it has settled,
     * then it assign its promise to lastQueuedTask, which makes it the new tail, so the next arrival queues behind it.
     */
    private lastQueuedTask: Promise<unknown>;
    /**
     * It's a registry of every task that has been scheduled but hasn't finished yet — so a queued task that hasn't started yet is in there too.
     * Its only job is to hold the AbortControllers and kinds, so a newly arriving task can call abort() on the ones it supersedes (also based on the types of tasks).
     */
    private pendingTasksInfos : Set<{ kind: Kind; controller: AbortController }>;


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
        this.lastQueuedTask = Promise.resolve();
        this.pendingTasksInfos = new Set();
    }

    private enqueue<T>(kind: Kind, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
        // Supersede synchronously. 
        // A new translate cancels pending translates.
        // A new load cancels pending translates AND pending loads.
        for (const task of this.pendingTasksInfos) {
            if (kind === "load" || task.kind === "translate") task.controller.abort();
        }

        const entry = { kind, controller: new AbortController() };
        this.pendingTasksInfos.add(entry);

        // Queue behind whatever is already running, ignoring its outcome.
        const run = () => {
            return operation(entry.controller.signal).finally(() => this.pendingTasksInfos.delete(entry));
        };
        const promise = this.lastQueuedTask.then(run, run);

        // The chain itself must never reject, or it poisons every later task.
        this.lastQueuedTask = promise.catch(() => {});
        return promise;
    }

    translate(text: string, from: string, to: string): Promise<string> {
        if (from === to) return Promise.resolve(text);   //if the source and target languages are the same, we return the input text as a result immediately

        return this.enqueue("translate", (signal) => this.performTranslate(text, from, to, signal));
    }

    loadLanguagePairResources(srcLang: string, tgtLang: string): Promise<void> {
        return this.enqueue("load", (signal) => this.performLoadLanguagePairResources(srcLang, tgtLang, signal));
    }


    private async performTranslate(text: string, from: string, to: string, signal: AbortSignal): Promise<string> {
        signal.throwIfAborted();
        // Execute translation
        const response = await this.translator.translate(
            { from, to, text, html: false, qualityScores: false },
            { signal: signal }
        );
        return response.target.text;
    }

    private async performLoadLanguagePairResources(srcLang: string, tgtLang: string, signal: AbortSignal): Promise<void> {
        signal.throwIfAborted();
        let worker = await this.translator.worker;
        signal.throwIfAborted();

        // we define the new needed language pairs
        let pairs: LanguagePair[] = []
        if(srcLang != "en"){
            pairs = pairs.concat({ from: srcLang, to: "en" }, { from: "en", to: srcLang });
        }
        if(tgtLang != "en") {
            pairs = pairs.concat({ from: tgtLang, to: "en" }, { from: "en", to: tgtLang });
        }

        // we eventually remove the old models (we remove all the models that aren't use for this new language pair)
        for (let key of this.languageResourcesManager.buffers.keys()) {
            let langs: LanguagePair = JSON.parse(key);
            if (!pairs.some(p => p.from === langs.from && p.to === langs.to)) {
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
        let model: TranslationModel;
        for (let pair of pairs) {
            // load for languageResourcesManager  (js)
            model = await this.languageResourcesManager.getTranslationModel(pair);  //we do not pass the loadLanguagesAbortController here because an internal interruption, without deletion of the buffer can cause problems, so we interrupt this operation only above, in the removal of unused models
            signal.throwIfAborted();
            // load for the languageResourcesManager worker  (wasm)
            if (!await worker.exports.hasTranslationModel(pair)) await worker.exports.loadTranslationModel(pair, model);
            signal.throwIfAborted();
        }
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