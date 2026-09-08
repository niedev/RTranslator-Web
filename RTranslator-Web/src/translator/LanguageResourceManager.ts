import { TranslatorBacking, type ModelFilesInfo, type LanguagePair, type TranslationModel, type TranslatorOptions } from "@browsermt/bergamot-translator/translator.js";
import { listDirectoryChildren } from "@src/file-system/file-system-tools"

export class LanguageResourceManager extends TranslatorBacking {
    mozillaFolder?: Promise<FileSystemDirectoryHandle>;

    constructor(options: TranslatorOptions) {
        super(options);
        this.mozillaFolder = undefined;
        this.getMozillaFolder();
    }

    async getMozillaFolder(): Promise<FileSystemDirectoryHandle> {
        if (!this.mozillaFolder) {
            // Assign the Promise chain directly to the attribute
            this.mozillaFolder = navigator.storage.getDirectory()
                .then(root => root.getDirectoryHandle("Translation", { create: true }))
                .then(translationFolder => translationFolder.getDirectoryHandle("Mozilla", { create: true }));
        }

        return this.mozillaFolder;
    }

    /**
     * This method returns a list containing info for each of the downloaded models.
     * 
     * The only information used for each model is the languages "​​from" and "to". Files information is not used, since we don't download files from TranslatorBacking
     * (because we override loadTranslationModel), which was the method that used this information, so we can omit it.
     * @returns list containing info for each of the downloaded models
     */
    override async loadModelRegistery(): Promise<ModelFilesInfo[]> {
        let mozillaFolder = await this.getMozillaFolder();
        let modelsDirs = await listDirectoryChildren(mozillaFolder);
        let modelFilesInfo: ModelFilesInfo[] = []
        for (let modelDir of modelsDirs) {
            modelFilesInfo.push({
                from: modelDir.name,
                to: "en"
            });
            modelFilesInfo.push({
                from: "en",
                to: modelDir.name
            });
        }
        return modelFilesInfo;
    }

    /**
     * This method will update the attribute this.registery, by adding the info of a new downloaded model, without reloading the entire registery with loadModelRegistery.
     */
    async addModelToRegistery(lang: string): Promise<void>{
        let registry = (await this.registry);
        registry.push({
            from: lang,
            to: "en"
        });
        registry.push({
            from: "en",
            to: lang
        });
        // the reassignement here is not necessary, because we change the object inside the promise instead of creating a copy like in the removeModelFromRegistery method.
    }

    /**
     * This method will update the attribute this.registery, by removing the info of a deleted downloaded model, without reloading the entire registery with loadModelRegistery.
     */
    async removeModelFromRegistery(lang: string): Promise<void>{
        //removes all the models that have lang as a source or target language (they should be always 2 lang -> en and en -> lang)
        let updatedRegistry = (await this.registry).filter((value) => {value.from != lang && value.to != lang});
        this.registry = Promise.resolve(updatedRegistry);
    }

    /**
     * This method will read the model indentified by the langs combo (from and to) from the OPFS file system,
     * and return all its data in the form of ArrayBuffers.
     * 
     * This method will override the default behaviour of the TranslatorBacking, replacing the download of the model
     * with the read from our private file system. (because we handle the download and storage ourself, to improve the experience)
     * 
     * @param langs the lang combo of the model
     * @param options 
     * @returns an object containing all the data associated to the model in the form of ArrayBuffers
     */
    override async loadTranslationModel(langs: LanguagePair, options?: { signal?: AbortSignal }): Promise<TranslationModel> {
        // Find that model in the registry which will tell us about its files
        const modelInfo = (await this.registry).find(model => model.from == langs.from && model.to == langs.to);

        if (!modelInfo)
            throw new Error(`No model for '${langs.from}' -> '${langs.to}'`);

        let language = langs.from != "en" ? langs.from : langs.to;  //get the language different from "en" (pivot) in the lanaguage pair.

        let mozillaFolder = await this.getMozillaFolder();
        let languageDir = await mozillaFolder.getDirectoryHandle(language, { create: false });
        let modelDir = await languageDir.getDirectoryHandle(langs.from + langs.to);
        let modelFiles = await listDirectoryChildren(modelDir);
        let config: {
            [key:string]: string
        } = {}   //todo: improve the settings in RTranslator and insert those here.

        let model: ArrayBuffer|null= null;
        let vocab: ArrayBuffer|null= null;
        let srcVocab: ArrayBuffer|null= null;
        let tgtVocab: ArrayBuffer|null= null;
        let lexShort: ArrayBuffer|null = null;

        if (!modelFiles) throw new Error("No models files found");
        for (let file of modelFiles) {
            if (file.handle instanceof FileSystemFileHandle) {
                if (file.name.includes("model")) {
                    //if the model is quantized we specify the quantization strategy to use in the config
                    if (file.name.endsWith('intgemm8.bin'))
                        config['gemm-precision'] = 'int8shiftAll';
                    if (file.name.endsWith('intgemm.alphas.bin'))
                        config['gemm-precision'] = 'int8shiftAlphaAll';
                    //we exctract the model data
                    model = await (await file.handle.getFile()).arrayBuffer();
                    continue;
                }
                if (file.name.includes("srcvocab")) {
                    srcVocab = await (await file.handle.getFile()).arrayBuffer();
                    continue;
                }
                if (file.name.includes("trgvocab")) {
                    tgtVocab = await (await file.handle.getFile()).arrayBuffer();
                    continue;
                }
                if (file.name.includes("vocab")) {
                    vocab = await (await file.handle.getFile()).arrayBuffer();
                    continue;
                }
                if (file.name.includes("lex.")) {
                    lexShort = await (await file.handle.getFile()).arrayBuffer();
                    continue;
                }
            }
        }

        let vocabs: ArrayBuffer[]|null= null;
        if (srcVocab && tgtVocab) {
            vocabs = [srcVocab, tgtVocab];
        } else if (vocab) {
            vocabs = [vocab]
        }

        if (model && vocabs && lexShort) {
            return {
                model: model,
                vocabs: vocabs,
                shortlist: lexShort,
                config: config
            };
        }else{
            throw Error("Missing some of the required files");
        }
    }
}