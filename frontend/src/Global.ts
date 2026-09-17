import type { DownloadInfo } from "@src/downloader/DownloadInfo"
import { Translator } from "@src/translator/Transator"
import { DownloadManager } from "@src/downloader/DownloadManager"
import { XMLParser } from 'fast-xml-parser';
import { listDirectoryChildrenReady } from "./file-system/file-system-tools";
import mozillaLanguagesXml from './assets/languages/mozilla_supported_languages.xml?raw';

export class Global {
    private initialized: boolean;
    private mozillaFolder?: Promise<FileSystemDirectoryHandle>;
    private translator: Translator;
    private downloadManager: DownloadManager;
    private mozillaModels: DownloadInfo[];
    private selectedFirstLanguage: string | null;
    private selectedSecondLanguage: string | null;
    private state: State = {
        isInitialized: false,
        mozillaModels: [],
        firstLanguage: null,
        secondLanguage: null
    };
    private listeners = new Set<() => void>();

    constructor() {
        this.initialized = false;
        this.mozillaFolder = undefined;
        this.getMozillaFolder();
        this.translator = new Translator();
        this.downloadManager = new DownloadManager();
        this.mozillaModels = [];
        this.selectedFirstLanguage = null;
        this.selectedSecondLanguage = null;
    }

    /* ==========================================
    *  STATE INTERFACE
    *  Interface to make React (via useSyncExternalStore) or other external systems update the state according to the attributes of this object
    * ========================================== */

    public subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    public getSnapshot = () => {
        return this.state;
    };

    // Helper to update state immutably and notify React (or other systems).
    // With React Compiler, if one of the properties of the object stays the same between renders
    // a component that has that property as a prop arg could not re render.
    // So given that mozillaModels is the only non primitive attribute, there is the mozillaModelsChanged
    // param to force the mozillaModels change in the case there has been updates on the internals of this obj.
    // The same principle applies to the indexChanged internal DownloadInfo object.
    private updateState(mozillaModelsChanged = false, indexChanged = -1) {
        let mozillaModelsCopy = mozillaModelsChanged ? [...this.mozillaModels] : this.mozillaModels;
        if(indexChanged >= 0 && indexChanged < mozillaModelsCopy.length){
            mozillaModelsCopy[indexChanged] = Object.assign({}, mozillaModelsCopy[indexChanged])  // clone the object at index: indexChanged
        }
        mozillaModelsCopy
        this.state = {
            isInitialized: this.initialized,
            mozillaModels: mozillaModelsCopy,
            firstLanguage: this.selectedFirstLanguage,
            secondLanguage: this.selectedSecondLanguage,
        }
        this.listeners.forEach(listener => listener());
    }

    /* ========================================== */

    public async init(): Promise<void> {
        // initialization of the mozillaModels
        let languagesInfos = await this.processLanguages();
        let mozillaFolder = await this.getMozillaFolder();
        let modelsDirs = await listDirectoryChildrenReady(mozillaFolder);
        // If the env variable exists, use it (GitHub Pages). 
        // Otherwise, default to the relative path (Self-hosted Docker).
        const baseUrl = import.meta.env.VITE_DOWNLOAD_BASE_URL ?? '/api/downloads/';
        this.mozillaModels = languagesInfos.map((item) => {
            let fileName = "Mozilla_" + item.lang + ".zip";
            if (modelsDirs.find((value) => value.name == item.lang)) {
                // the model is installed
                return {
                    name: item.lang,
                    size: item.size,
                    url: baseUrl + fileName,
                    currentProgress: 100,
                    unzipping: false,
                    downloading: false,
                    downloadCompleted: true,
                }
            } else {
                // the model is not installed
                return {
                    name: item.lang,
                    size: item.size,
                    url: baseUrl + fileName,
                    currentProgress: 0,
                    unzipping: false,
                    downloading: false,
                    downloadCompleted: false,
                }
            }
        });
        // initialization of the selected languages
        let firstLang = this.getFirstLanguage();
        let secondLang = this.getSecondLanguage();
        await this.translator.loadLanguagePairResources(firstLang, secondLang);
        //todo: do cleanup of all the folders that have an interrupted download (the ones in Tramslation/Mozilla/ that not contain .ready file)
        this.initialized = true;
        this.updateState(true);

    }

    public getMozillaModels() {
        return this.mozillaModels;
    }

    public getInstalledMozillaModels() {
        return this.mozillaModels.filter((value) => value.downloadCompleted);
    }

    public getFirstLanguage() {
        let changed = false;
        let language = this.selectedFirstLanguage;
        // if the attribute is not initialized yet we fetch it from the localStorage
        if (!language) {
            language = localStorage.getItem("firstTextLanguage");
            changed = true;
        }
        // if the language is fetch from the attribute or the local storage we check if its model is installed
        if (language) {
            let installedMozillaModels = this.getInstalledMozillaModels();
            if (language != "en" && !installedMozillaModels.find((value) => value.name === language)) {
                language = null;
            }
        }
        // if the language is not present in the attribute or the local storage (first app start ever)
        // or if its model is not installed, we initialize it with the default first language
        if (!language) {
            language = this.getDefaultFirstLanguage();
            changed = true;
        }

        // if the attribute has been changed by the code above we set it and save it in localStorage
        if (changed) {
            this.selectedFirstLanguage = language;
            localStorage.setItem("firstTextLanguage", language);
            this.updateState();
        }

        return language;
    }

    public getSecondLanguage() {
        let changed = false;
        let language = this.selectedSecondLanguage;
        // if the attribute is not initialized yet we fetch it from the localStorage
        if (!language) {
            language = localStorage.getItem("secondTextLanguage");
            changed = true;
        }
        // if the language is fetch from the attribute or the local storage we check if its model is installed
        if (language) {
            let installedMozillaModels = this.getInstalledMozillaModels();
            if (language != "en" && !installedMozillaModels.find((value) => value.name === language)) {
                language = null;
            }
        }
        // if the language is not present in the attribute or the local storage (first app start ever)
        // or if its model is not installed, we initialize it with the default second language
        if (!language) {
            language = this.getDefaultSecondLanguage();
            changed = true;
        }

        // if the attribute has been changed by the code above we set it and save it in localStorage
        if (changed) {
            this.selectedSecondLanguage = language;
            localStorage.setItem("secondTextLanguage", language);
            this.updateState();
        }

        return language;
    }

    public async setFirstLanguage(lang: string): Promise<void> {
        this.selectedFirstLanguage = lang;
        let firstLanguage = this.getFirstLanguage();
        localStorage.setItem("firstTextLanguage", firstLanguage);
        this.updateState();
        await this.translator.loadLanguagePairResources(firstLanguage, this.getSecondLanguage());
    }

    public async setSecondLanguage(lang: string): Promise<void> {
        this.selectedSecondLanguage = lang;
        let secondLanguage = this.getSecondLanguage();
        localStorage.setItem("secondTextLanguage", secondLanguage);
        this.updateState();
        await this.translator.loadLanguagePairResources(this.getFirstLanguage(), secondLanguage);
    }

    public async switchSelectedLanguages(): Promise<void> {
        let firstLanguage = this.getFirstLanguage();
        let secondLanguage = this.getSecondLanguage();
        localStorage.setItem("firstTextLanguage", secondLanguage);
        localStorage.setItem("secondTextLanguage", firstLanguage);
        this.selectedFirstLanguage = secondLanguage;
        this.selectedSecondLanguage = firstLanguage;
        this.updateState();
        //loadLanguagePairResources normally wouldn't change nothing in this case, it does only in the case getFirstLanguage() or getSecondLanguage() change the language.
        await this.translator.loadLanguagePairResources(this.selectedFirstLanguage, this.selectedSecondLanguage);
    }

    public async translate(text: string): Promise<string>  {
        return this.translator.translate(text, this.getFirstLanguage(), this.getSecondLanguage());
    }

    /**
     * 
     * @param download 
     * @returns An empty Promise that will be resolved when the download has been completed successfully.
     * @throws An error of type DOMException and name == "AbortError" if the download has been interrupted with cancelModelDownload, other errors if the download fails.
     */
    public async downloadModel(lang: string ): Promise<void> {
        let modelDownloadIndex = this.getMozillaModels().findIndex((item) => item.name == lang);
        let modelDownload = this.getMozillaModels()[modelDownloadIndex];
        if(modelDownload && !modelDownload.downloading && !modelDownload.downloadCompleted){
            try {
                // start of the download
                modelDownload.downloading = true;
                this.updateState(true, modelDownloadIndex);
                await this.downloadManager.downloadZip(modelDownload.url, await this.getMozillaFolder(), modelDownload.name, (loaded, total, isUnzipping) => {
                    // download status update
                    modelDownload.currentProgress = loaded/total * 100;
                    modelDownload.unzipping = isUnzipping;
                    this.updateState(true, modelDownloadIndex);
                });
                // the download is completed successfully
                modelDownload.downloadCompleted = true;
                modelDownload.currentProgress = 100;
                modelDownload.downloading = false;
                modelDownload.unzipping = false;
                await this.translator.addModelToRegistery(modelDownload.name);
                this.updateState(true, modelDownloadIndex);
            } catch (e) {
                // the downloaded has been interrupted by the user or by an error, so we change its status accrodingly
                // normally this update happens also in the cancelDownload, but here is necessary in the case the download
                // has not been interrupted by the user but by an error (a double change to the status is not a problem)
                modelDownload.downloadCompleted = false;
                modelDownload.currentProgress = 0;
                modelDownload.downloading = false;
                modelDownload.unzipping = false;
                this.updateState(true, modelDownloadIndex);
                throw e;   //note that if "(e instanceof DOMException && e.name == "AbortError")"" it means that the download has been interrupted by the user
            }
        }
    }

    /**
     * This method can be called to cancel a download and delete the downloaded content,
     * or to just the delete the downloaded content of an already finished download.
     * 
     * @param download 
     * @returns An empty Promise that will be resolved when the cancel operation has been completed.
     */
    public async cancelModelDownload(lang: string): Promise<void> {
        let modelDownloadIndex = this.getMozillaModels().findIndex((item) => item.name == lang);
        let modelDownload = this.getMozillaModels()[modelDownloadIndex];
        if(modelDownload){
            await this.downloadManager.cancelDownload(await this.getMozillaFolder(), lang);
            // we update the status of the model
            // normally this update happens also in the startDownload if the download was running,
            // but here is necessary in the case the download was not running (a double change to the status is not a problem)
            modelDownload.downloadCompleted = false;
            modelDownload.currentProgress = 0;
            modelDownload.downloading = false;
            modelDownload.unzipping = false;
            // we update the registery of the translator
            await this.translator.removeModelFromRegistery(modelDownload.name);
            // we eventually update the selected languages (if one of them was the one deleted)
            let oldFirstLang = this.selectedFirstLanguage;
            let oldSecondLang = this.selectedSecondLanguage;
            let newFirstLang = this.getFirstLanguage();
            let newSecondLang = this.getSecondLanguage();
            this.updateState(true, modelDownloadIndex);   //we update the status here to not await the model load (too long)
            if(newFirstLang != oldFirstLang || newSecondLang != oldSecondLang){
                await this.translator.loadLanguagePairResources(newFirstLang, newSecondLang);
            }
        }
    }



    private getDefaultFirstLanguage() {
        return "en";
    }

    private getDefaultSecondLanguage() {
        let installedMozillaModels = this.getInstalledMozillaModels();
        if (installedMozillaModels.length > 0) {
            return installedMozillaModels[0].name;
        } else {
            return "en";
        }
    }

    private async getMozillaFolder(): Promise<FileSystemDirectoryHandle> {
        if (!this.mozillaFolder) {
            // Assign the Promise chain directly to the attribute
            this.mozillaFolder = navigator.storage.getDirectory()
                .then(root => root.getDirectoryHandle("Translation", { create: true }))
                .then(translationFolder => translationFolder.getDirectoryHandle("Mozilla", { create: true }));
        }

        return this.mozillaFolder;
    }

    private async processLanguages(): Promise<LanguageInfo[]> {
        try {
            const parser = new XMLParser({
                isArray: (name) => name === 'language'
            });

            const parsedData = parser.parse(mozillaLanguagesXml);

            // Map and return the array
            return parsedData.languages.language.map((item: any) => ({
                lang: String(item.code),
                size: Number(item.size)
            }));

        } catch (error) {
            console.error('Error reading or parsing XML:', error);
            throw error;
        }
    }
}

interface LanguageInfo {
    lang: string;
    size: number;
}

export interface State {
    isInitialized: boolean;
    mozillaModels: DownloadInfo[];
    firstLanguage: string | null;
    secondLanguage: string | null;
}