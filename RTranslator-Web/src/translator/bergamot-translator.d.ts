declare module '@browsermt/bergamot-translator/translator.js' {
    export interface LanguagePair { from: string; to: string }

    export type StringifiedLanguagePair = `{"from":"${string}","to":"${string}"}`;

    /**
     * Represents all the files info of a model (identified by from and to),
     * for each file, the name attribute is actually its url
     */
    export interface ModelFilesInfo {
        from: string,
        to: string,
        files?: {
            [part: string]: {
                name: string,
                size: number,
                expectedSha256Hash: string
            }
        }[]
    }

    export interface TranslationModel {
        model: ArrayBuffer,
        vocabs: ArrayBuffer[],
        shortlist: ArrayBuffer,
        qualityModel?: ArrayBuffer,
        config?: {
            [key:string]: string
        }
    }

    export interface TranslationRequest {
        from: string;
        to: string;
        text: string;
        html?: boolean;
        qualityScores?: boolean;
    }

    export interface TranslationResponse {
        request: TranslationRequest;
        target: { text: string };
    }

    export interface TranslatorOptions {
        cacheSize?: number;
        useNativeIntGemm?: boolean;
        downloadTimeout?: number;
        registryUrl?: string;
        pivotLanguage?: string;
        onerror?: (err: Error) => void;
        workers?: number;
        batchSize?: number;
        workerUrl?: string;
    }

    export class SupersededError extends Error { }
    export class CancelledError extends Error { }

    /**
     * Wrapper around bergamot-translator loading and model management.
     */
    export class TranslatorBacking {
        options: TranslatorOptions | {};

        registryUrl: string;

        downloadTimeout: number;

        /**
         * Registry of all available models and their urls.
         */
        registry: Promise<ModelFilesInfo[]>;

        /**
         * Map of downloaded model data files as buffers per model.
         */
        buffers: Map<StringifiedLanguagePair, Promise<TranslationModel>>;

        /**
         * The language used as middle man if a language pair doesn't have a model for direct translation.
         */
        pivotLanguage: string;
        
        /**
         * A map of language-pairs to a list of models you need for it.
         */
        models: Map<StringifiedLanguagePair, Promise<LanguagePair[]>>;

        constructor(options?: TranslatorOptions);

        /**
         * Loads a worker thread, and wraps it in a message passing proxy. I.e. it
         * exposes the entire interface of TranslationWorker here, and all calls
         * to it are async. Do note that you can only pass arguments that survive
         * being copied into a message. 
         */
        loadWorker(): Promise<{worker:Worker, exports:Proxy<BergamotTranslatorWorker>}>;

        /**
         * Loads the model registry. Uses the registry shipped with this extension,
         * but formatted a bit easier to use, and future-proofed to be swapped out
         * with a TranslateLocally type registry.
         */
        loadModelRegistery(): Promise<ModelFilesInfo[]>;

        /**
         * Gets or loads translation model data. Caching wrapper around
         * `loadTranslationModel()`.
         */
        getTranslationModel(langs: LanguagePair, options?: any): Promise<TranslationModel>;

        /**
         * Downloads a translation model and returns a set of
         * ArrayBuffers. These can then be passed to a TranslationWorker thread
         * to instantiate a TranslationModel inside the WASM vm.
         */
        loadTranslationModel(langs: LanguagePair, options?: {signal?:AbortSignal}): Promise<TranslationModel>;

        /**
         * Crappy named method that gives you a list of models to translate from
         * one language into the other. Generally this will be the same as you
         * just put in if there is a direct model, but it could return a list of
         * two models if you need to pivot through a third language.
         * Returns just [{from:str,to:str}...]. To be used something like this:
         * ```
         * const models = await this.getModels(from, to);
         * models.forEach(({from, to}) => {
         *   const buffers = await this.loadTranslationModel({from,to});
         *   [TranslationWorker].loadTranslationModel({from,to}, buffers)
         * });
         * ```
         */
        getModels(langs: LanguagePair): Promise<TranslationModel[]>;

        /**
         * Find model (or model pair) to translate from `from` to `to`.
         */
        findModels(from: string, to: string): Promise<TranslationModel[]>;

        /**
         * Error handler for all errors that are async, not tied to a specific
         * call and that are unrecoverable.
         */
        onerror(error: Error): void;

        /**
         * Helper to download file from the web. Verifies the checksum.
         * @param url
         * @param checksum sha256 checksum as hexadecimal string
         * @param extra fetch options
         */
        fetch(url: string, checksum?: string, extra?: {signal:AbortSignal}): Promise<ArrayBuffer>;

        /**
         * Converts the hexadecimal hashes from the registry to something we can use with
         * the fetch() method.
         */
        hexToBase64(hexstring): string
    }

    export class BatchTranslator {
        constructor(options?: TranslatorOptions, backing?: TranslatorBacking);
        delete(): Promise<void>;
        translate(request: TranslationRequest): Promise<TranslationResponse>;
    }

    export class LatencyOptimisedTranslator {
        backing: TranslatorBacking;

        worker: Promise<{idle:boolean, worker:Worker, exports:Proxy<BergamotTranslatorWorker>}>;

        pending: {request: TranslationRequest, accept:(TranslationResponse), reject:(Error)} | null;

        constructor(options?: TranslatorOptions, backing?: TranslatorBacking);
        delete(): Promise<void>;
        translate(request: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResponse>;
    }

    export class BergamotTranslatorWorker {
        /**
         * Returns whether a model has already been loaded in this worker. Marked
         * async because the message passing interface we use expects async methods.
         */ 
        hasTranslationModel(langs: LanguagePair): boolean

        /**
         * Loads a translation model from a set of file buffers. After this, the
         * model is available to translate with and `hasTranslationModel()` will
         * return true for this pair.
         */ 
        loadTranslationModel(langs: LanguagePair, buffers: TranslationModel): void;

        /**
         * Frees up memory used by old translation model. Does nothing if model is
         * already deleted.
         */
        freeTranslationModel(langs: LanguagePair): void;
    }

    // Create the Proxy generic type that replicate the bahaviour of the Proxy<BergamotTranslatorWorker> type inside the worker 
    // in LatencyOptimisedTranslator and TranslatorBacking, in those cases, the Proxy wrapper mainstains all the original mathods of the wrapped object, but it converts those to async (so they return a promise).
    // This tells TypeScript: "Take object T, look at all its functions, and wrap their return types in a Promise (if they aren't already)."
    export type Proxy<T> = {
        [K in keyof T]: T[K] extends (...args: infer A) => infer R
            ? (...args: A) => R extends Promise<any> ? R : Promise<R>
            : never; // In your JS proxy, all non-function property access is effectively overridden anyway
    };
}