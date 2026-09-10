import type {
	BackingInstance, BergamotModule, BergamotOptions, LatencyTranslatorInstance,
	ModelBuffers, ModelSource, Pair, TranslatorSnapshot, TranslatorStatus,
} from './types_old';

const BERGAMOT_URL = '/bergamot/translator.js';
const PIVOT = 'en';

const cacheKey = (p: Pair) => JSON.stringify({ from: p.from, to: p.to });

function supportsSimd(): boolean {
	try {
		return WebAssembly.validate(new Uint8Array([
			0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
		]));
	} catch { return false; }
}

export class Translator {
	private readonly source: ModelSource;

	private mod: BergamotModule | null = null;
	private impl: LatencyTranslatorInstance | null = null;
	private backing: BackingInstance | null = null;
	private initPromise: Promise<void> | null = null;

	private loadedLangs = new Set<string>();
	private loadingLangs = new Set<string>();
	private errorMessage: string | null = null;

	/** Deliberately inert: StrictMode constructs this twice in dev. */
	constructor(source: ModelSource) {
		this.source = source;
	}

	init = (): Promise<void> => (this.initPromise ??= this.doInit());

	private async doInit(): Promise<void> {
		if (!supportsSimd()) {
			this.errorMessage = 'WebAssembly SIMD is not supported by this browser';
			throw new Error(this.errorMessage);
		}

		try {
			const mod = await import(/* @vite-ignore */ BERGAMOT_URL) as unknown as BergamotModule;
			this.mod = mod;

			// Held in a local const, NOT read off `this` inside the subclass:
			// TranslatorBacking's constructor calls loadModelRegistery() before any
			// subclass field initializer has run, so `this.something` would be
			// undefined at that moment. The closure sidesteps it entirely.
			const source = this.source;

			class LocalBacking extends mod.TranslatorBacking {
				override async loadModelRegistery(): Promise<Pair[]> {
					return source.listAvailablePairs();
				}
				override async loadTranslationModel(pair: Pair): Promise<ModelBuffers> {
					return source.readPair(pair);
				}
			}

			const options: BergamotOptions = {
				cacheSize: 2000,
				pivotLanguage: PIVOT,
				downloadTimeout: 0,   // irrelevant: our backing never uses fetch()
				onerror: (err: Error) => {
					this.errorMessage = err.message;
				},
			};

			this.backing = new LocalBacking(options);
			this.impl = new mod.LatencyOptimisedTranslator(options, this.backing);

			// Surfaces wasm compile/instantiate failures here, not on first use.
			await this.impl.worker;

			this.errorMessage = null;
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : String(err);
			this.initPromise = null;   // allow a retry
			throw err;
		}
	}

	/** Loads lang→en and en→lang into the worker. Idempotent. */
	loadLanguageResources = async (lang: string): Promise<void> => {
		await this.init();
		if (lang === PIVOT || this.loadedLangs.has(lang) || this.loadingLangs.has(lang)) return;

		this.loadingLangs.add(lang);
		try {
			this.refreshRegistry();
			const { exports } = await this.impl!.worker;

			// Sequential on purpose: two allocations at once spikes the wasm heap.
			for (const pair of Translator.pairsFor(lang)) {
				if (await exports.hasTranslationModel(pair)) continue;
				const buffers = await this.backing!.getTranslationModel(pair);
				await exports.loadTranslationModel(pair, buffers);
			}

			this.loadedLangs.add(lang);
		} finally {
			this.loadingLangs.delete(lang);
		}
	};

	unloadLanguageResources = async (lang: string): Promise<void> => {
		if (lang === PIVOT || !this.impl || !this.backing) return;

		const { exports } = await this.impl.worker;

		for (const pair of Translator.pairsFor(lang)) {
			await exports.freeTranslationModel(pair);       // wasm-side copy
			this.backing.buffers.delete(cacheKey(pair));    // JS-side ArrayBuffers
		}

		this.loadedLangs.delete(lang);
		this.refreshRegistry();
	};

	isLoaded = (lang: string): boolean => lang === PIVOT || this.loadedLangs.has(lang);

	private static pairsFor(lang: string): Pair[] {
		return [{ from: lang, to: PIVOT }, { from: PIVOT, to: lang }];
	}

	/**
	 * TranslatorBacking caches the registry promise and the pair→models lookup
	 * forever, so both must be invalidated when the installed set changes.
	 */
	private refreshRegistry(): void {
		const backing = this.backing!;
		backing.registry = backing.loadModelRegistery();
		backing.models.clear();
	}

	translate = async (
		text: string,
		from: string,
		to: string,
		options?: { html?: boolean; signal?: AbortSignal },
	): Promise<string> => {
		await this.init();
		if (from === to || text.trim() === '') return text;

		const response = await this.impl!.translate(
			{ from, to, text, html: options?.html ?? false },
			{ signal: options?.signal },
		);
		return response.target.text;
	};

	destroy = async (): Promise<void> => {
		const impl = this.impl;
		this.impl = null;
		this.backing = null;
		this.mod = null;
		this.initPromise = null;
		this.loadedLangs.clear();
		this.loadingLangs.clear();
		await impl?.delete();
	};
}