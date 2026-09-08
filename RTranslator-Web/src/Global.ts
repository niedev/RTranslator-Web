import type { DownloadInfo } from "@src/downloader/DownloadInfo"
import { Translator } from "@src/translator/Transator"
import { DownloadManager } from "@src/downloader/DownloadManager"
import { XMLParser } from 'fast-xml-parser';
import { listDirectoryChildren, listDirectoryChildrenReady } from "./file-system/file-system-tools";
import mozillaLanguagesXml from './assets/languages/mozilla_supported_languages.xml?raw';

export class Global {
    private mozillaFolder?: Promise<FileSystemDirectoryHandle>;
    private translator: Translator;
    private downloadManager: DownloadManager;
    private mozillaModels: DownloadInfo[];
    private selectedFirstLanguage: string | null;
    private selectedSecondLanguage: string | null;

    constructor() {
        this.mozillaFolder = undefined;
        this.getMozillaFolder();
        this.translator = new Translator();
        this.downloadManager = new DownloadManager();
        this.mozillaModels = [];
        this.selectedFirstLanguage = null;
        this.selectedSecondLanguage = null;
    }

    public async init(): Promise<void> {
        // initialization of the mozillaModels
        let languagesInfos = await this.processLanguages();
        let mozillaFolder = await this.getMozillaFolder();
        let modelsDirs = await listDirectoryChildrenReady(mozillaFolder);
        let baseUrl = "https://github.com/niedev/OnnxModelsEnhancer/releases/download/v1.0.0-beta/";
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
            if (!installedMozillaModels.find((value) => value.name === language)) {
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
            if (!installedMozillaModels.find((value) => value.name === language)) {
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
        }

        return language;
    }

    public setFirstLanguage(lang: string) {
        this.selectedFirstLanguage = lang;
        let firstLanguage = this.getFirstLanguage();
        localStorage.setItem("firstTextLanguage", firstLanguage);
        this.translator.loadLanguagePairResources(firstLanguage, this.getSecondLanguage());
    }

    public setSecondLanguage(lang: string) {
        this.selectedSecondLanguage = lang;
        let secondLanguage = this.getSecondLanguage();
        localStorage.setItem("secondTextLanguage", secondLanguage);
        this.translator.loadLanguagePairResources(this.getFirstLanguage(), secondLanguage);
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
    public async downloadModel(lang: string): Promise<void> {
        let modelDownload = this.getMozillaModels().find((item) => item.name == lang);
        if(modelDownload && !modelDownload.downloading && !modelDownload.downloadCompleted){
            try {
                // start of the download
                modelDownload.downloading = true;
                await this.downloadManager.downloadZip(modelDownload.url, await this.getMozillaFolder(), modelDownload.name, (loaded, total, isUnzipping) => {
                    // download status update
                    modelDownload.currentProgress = total/loaded * 100;
                    modelDownload.unzipping = isUnzipping;
                });
                // the download is completed successfully
                modelDownload.downloadCompleted = true;
                modelDownload.currentProgress = 100;
                modelDownload.downloading = false;
                modelDownload.unzipping = false;
                this.translator.addModelToRegistery(modelDownload.name);
            } catch (e) {
                // the downloaded has been interrupted by the user or by an error, so we change its status accrodingly
                // normally this update happens also in the cancelDownload, but here is necessary in the case the download
                // has not been interrupted by the user but by an error (a double change to the status is not a problem)
                modelDownload.downloadCompleted = false;
                modelDownload.currentProgress = 0;
                modelDownload.downloading = false;
                modelDownload.unzipping = false;
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
        let modelDownload = this.getMozillaModels().find((item) => item.name == lang);
        if(modelDownload){
            await this.downloadManager.cancelDownload(await this.getMozillaFolder(), lang);
            // we update the status of the model
            // normally this update happens also in the startDownload if the download was running,
            // but here is necessary in the case the download was not running (a double change to the status is not a problem)
            modelDownload.downloadCompleted = false;
            modelDownload.currentProgress = 0;
            modelDownload.downloading = false;
            modelDownload.unzipping = false;
            this.translator.removeModelFromRegistery(modelDownload.name)
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