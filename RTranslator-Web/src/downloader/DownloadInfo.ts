export interface DownloadInfo {
    // static variables (these will not be changed after the initialization)
    name: string;
    url: string;
    size: number;  //size in kb (they are not exact, because this is used only to show the progress)
    // dynamic variables  (these will be changed synamically depending on the status of the download or the model)
    currentProgress: number;  //progress percentage of the download
    unzipping: boolean;
    downloading: boolean;
    downloadCompleted: boolean;
}