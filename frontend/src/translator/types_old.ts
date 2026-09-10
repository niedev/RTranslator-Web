export interface Pair { from: string; to: string }

export interface ModelBuffers {
    model: ArrayBuffer;
    shortlist: ArrayBuffer;
    vocabs: ArrayBuffer[];
    qualityModel?: ArrayBuffer | null;
    config?: Record<string, string | number | boolean>;
}

/** Implemented by your existing download/storage layer. */
export interface ModelSource {
    /** Pairs whose files are on disk right now. Re-read on every call. */
    listAvailablePairs(): Promise<Pair[]>;
    readPair(pair: Pair): Promise<ModelBuffers>;
}

export interface WorkerExports {
    hasTranslationModel(pair: Pair): Promise<boolean>;
    loadTranslationModel(pair: Pair, buffers: ModelBuffers): Promise<void>;
    freeTranslationModel(pair: Pair): Promise<void>;
}
export interface WorkerHandle { worker: Worker; exports: WorkerExports; idle: boolean }

export interface BergamotOptions {
    cacheSize?: number;
    pivotLanguage?: string | null;
    downloadTimeout?: number;
    useNativeIntGemm?: boolean;
    onerror?: (err: Error) => void;
}

export interface BackingInstance {
    registry: Promise<Pair[]>;
    models: Map<string, Promise<Pair[]>>;
    buffers: Map<string, Promise<ModelBuffers>>;
    loadModelRegistery(): Promise<Pair[]>;          // sic: the typo is in the library
    loadTranslationModel(pair: Pair, options?: { signal?: AbortSignal }): Promise<ModelBuffers>;
    getTranslationModel(pair: Pair, options?: { signal?: AbortSignal }): Promise<ModelBuffers>;
    getModels(pair: Pair): Promise<Pair[]>;
    loadWorker(): Promise<WorkerHandle>;
}

export interface TranslationRequest {
    from: string; to: string; text: string; html?: boolean; qualityScores?: boolean;
}
export interface TranslationResponse { request: TranslationRequest; target: { text: string } }

export interface LatencyTranslatorInstance {
    backing: BackingInstance;
    worker: Promise<WorkerHandle>;
    translate(req: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResponse>;
    delete(): Promise<void>;
}

export interface BergamotModule {
    TranslatorBacking: new (options: BergamotOptions) => BackingInstance;
    LatencyOptimisedTranslator: new (
        options: BergamotOptions, backing?: BackingInstance
    ) => LatencyTranslatorInstance;
    SupersededError: new () => Error;
    CancelledError: new (message?: string) => Error;
}

export type TranslatorStatus = 'idle' | 'initializing' | 'ready' | 'unsupported' | 'error';

export interface TranslatorSnapshot {
    status: TranslatorStatus;
    loaded: readonly string[];
    loading: readonly string[];
    error: string | null;
}