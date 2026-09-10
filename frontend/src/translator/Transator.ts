import {LatencyOptimisedTranslator, type LanguagePair, type TranslationModel, type TranslatorOptions} from "@browsermt/bergamot-translator/translator.js";
import {LanguageResourceManager} from "@src/translator/LanguageResourceManager"

export class Translator {
    private translator: LatencyOptimisedTranslator;
    private languageResourcesManager: LanguageResourceManager;

    constructor() {
        const options: TranslatorOptions = {
            cacheSize: 2000,
            pivotLanguage: "en",
            downloadTimeout: 0,   // irrelevant: our backing never uses fetch()
            /**onerror: (err: Error) => {  //todo: implement error handling
                console.log(err.stack);
            },**/
        };
        this.languageResourcesManager = new LanguageResourceManager(options);
        this.translator = new LatencyOptimisedTranslator(options, this.languageResourcesManager);
    }

    async translate (text: string, from: string, to: string): Promise<string> {
        if(from === to) return Promise.resolve(text);  //if the source and target languages are the same, we return the input text as a result immediately

        const response = await this.translator.translate(
			{ from, to, text, html: false, qualityScores: false }
		);
		return response.target.text;
    }

    async loadLanguagePairResources(srcLang: string, tgtLang: string): Promise<void> {  //todo: gestire il caso una o entrambe le lingue siano inglese.
        let worker = await this.translator.worker;
        // we eventually remove the old models (we remove all the models that aren't use for this new language pair)    
        for(let key of this.languageResourcesManager.buffers.keys()){
            let langs: LanguagePair = JSON.parse(key);
            if((srcLang != "en" && langs.from != srcLang && langs.to != srcLang) && (tgtLang != "en" && langs.from != tgtLang && langs.to != tgtLang)){
                // old model remove for the languageResourcesManager worker  (wasm)
                await worker.exports.freeTranslationModel(langs);  
                // old model remove for languageResourcesManager  (js)
                this.languageResourcesManager.buffers.delete(key);  //todo: find a way to interrupt the processes connected to the promises removed, if necessary
            }
        }
        // we load the new models  (sequential on purpose: two allocations at once spikes the wasm heap)
        let pairs = [{from: srcLang, to: "en"}, {from: "en", to: srcLang}, {from: tgtLang, to: "en"}, {from: "en", to: tgtLang}]
        let model: TranslationModel;
        for(let pair of pairs){
            if(pair.to == "en" && pair.from == "en") continue;  //if the srcLang or tgtLang (or both) are "en", we skip the load
            // load for languageResourcesManager  (js)
            model = await this.languageResourcesManager.getTranslationModel(pair);
            // load for the languageResourcesManager worker  (wasm)
            if (!await worker.exports.hasTranslationModel(pair)) await worker.exports.loadTranslationModel(pair, model);
        }
    }

    /**
     * This method will update the registery attribute of languageResourcesManager, by adding the info of a new downloaded model, without reloading the entire registery with loadModelRegistery (todo: migliorare la descrizione).
     */
    async addModelToRegistery(lang: string): Promise<void>{
        return this.languageResourcesManager.addModelToRegistery(lang);
    }

    /**
     * This method will update the registery attribute of languageResourcesManager, by removing the info of a deleted downloaded model, without reloading the entire registery with loadModelRegistery ((todo: migliorare la descrizione)).
     */
    async removeModelFromRegistery(lang: string): Promise<void>{
        return this.languageResourcesManager.removeModelFromRegistery(lang);
    }
}