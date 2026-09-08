import { ZipReader, BlobReader, Writer } from '@zip.js/zip.js';

export class DownloadManager {
    // Tracks active downloads so they can be securely aborted and awaited
    private activeTasks = new Map<string, { controller: AbortController, promise: Promise<void> }>();

    /**
     * This method creates a folder named 'folderName', under the 'parent' folder, downloads a .zip file from 'url', and extracts it inside the created folder.
     * After the download and extraction are completed, this method will create a .ready file inside it, to confirm that these operations have been completed without errors.
     * 
     * This method will also skip the download if it is already completed. 
     * Or it will clean the corrupted files and start the download and extraction again in case the .ready file is not present.
     */
    async downloadZip(
        url: string,
        parent: FileSystemDirectoryHandle,
        folderName: string,
        onProgress?: (loaded: number, total: number, isUnzipping: boolean) => void
    ): Promise<void> {
        // Prevent starting duplicate downloads for the same folder
        if (this.activeTasks.has(folderName)) {
            return this.activeTasks.get(folderName)!.promise;
        }

        const controller = new AbortController();
        const promise = this._executeDownload(url, parent, folderName, controller.signal, onProgress);

        this.activeTasks.set(folderName, { controller, promise });

        try {
            await promise;
        } finally {
            // Clean up the map, ensuring we only delete if it's the exact same task instance
            const current = this.activeTasks.get(folderName);
            if (current?.controller === controller) {
                this.activeTasks.delete(folderName);
            }
        }
    }

    /**
     * Cancels an ongoing download/unzip and deletes the folder.
     * If no download is running, it just deletes the folder.
     */
    async cancelDownload(parent: FileSystemDirectoryHandle, folderName: string): Promise<void> {
        const active = this.activeTasks.get(folderName);

        if (active) {
            // Signal all streams and loops to abort
            active.controller.abort();

            // Wait for the download task to catch the abort, release OPFS file locks, and clean up.
            try {
                await active.promise;
            } catch (e) {
                // Ignore the expected AbortError thrown by the cancelled task
            }
        } else {
            // If no active task is running, just clean up directly
            const tempZipName = `temp_${folderName}.zip`;
            await parent.removeEntry(tempZipName).catch(() => { });
            await parent.removeEntry(folderName, { recursive: true }).catch(() => { });
        }
    }

    private async _executeDownload(
        url: string,
        parent: FileSystemDirectoryHandle,
        folderName: string,
        signal: AbortSignal,
        onProgress?: (loaded: number, total: number, isUnzipping: boolean) => void
    ): Promise<void> {
        const isReady = await checkFolderExistsAndIsReady(parent, folderName);
        if (isReady) return;

        await parent.removeEntry(folderName, { recursive: true }).catch(() => { });
        const tempZipName = `temp_${folderName}.zip`;

        try {
            // DOWNLOAD PHASE - Pass abort signal to fetch
            const response = await fetch(url, { signal });
            if (!response.ok || !response.body) throw new Error('Fetch failed');

            const contentLength = response.headers.get('Content-Length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
            let loadedBytes = 0;
            let lastReportTime = 0;
            const REPORT_INTERVAL_MS = 250;

            const progressStream = new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                    loadedBytes += chunk.length;
                    const now = Date.now();

                    if (now - lastReportTime > REPORT_INTERVAL_MS || loadedBytes === totalBytes) {
                        onProgress?.(loadedBytes, totalBytes, false);
                        lastReportTime = now;
                    }
                    controller.enqueue(chunk);
                }
            });

            const zipFileHandle = await parent.getFileHandle(tempZipName, { create: true });
            const writableZipStream = await zipFileHandle.createWritable();

            // Pass abort signal to pipeTo: instantly aborts writing if cancelled
            await response.body.pipeThrough(progressStream).pipeTo(writableZipStream, { signal });

            // UNZIP PHASE: Alert the UI that the download is done and extraction is starting
            onProgress?.(loadedBytes, totalBytes, true);

            const targetDirHandle = await parent.getDirectoryHandle(folderName, { create: true });
            const zipFile = await zipFileHandle.getFile();
            const zipReader = new ZipReader(new BlobReader(zipFile));
            const entries = await zipReader.getEntries();

            for (const entry of entries) {
                // Check if aborted before processing the next file
                if (signal.aborted) throw new DOMException('Aborted by user', 'AbortError');

                if (entry.directory) {
                    await targetDirHandle.getDirectoryHandle(entry.filename, { create: true });
                    continue;
                }

                const pathParts = entry.filename.split('/');
                const fileName = pathParts.pop()!;
                let currentDir = targetDirHandle;

                for (const part of pathParts) {
                    currentDir = await currentDir.getDirectoryHandle(part, { create: true });
                }

                const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
                const writableFileStream = await fileHandle.createWritable();

                try {
                    if (entry.getData) {
                        // Pass signal into the custom Writer so it can abort mid-file decompression
                        await entry.getData(new OPFSWriter(writableFileStream, signal));
                    } else {
                        await writableFileStream.close();
                    }
                } catch (err) {
                    // Force abort the writable to instantly release the OPFS file lock
                    await writableFileStream.abort().catch(() => { });
                    throw err;
                }
            }

            await zipReader.close();
            await targetDirHandle.getFileHandle('.ready', { create: true });
            await parent.removeEntry(tempZipName);

        } catch (error) {
            // CLEANUP PHASE
            // This guarantees the folder is wiped whether it fails naturally or is manually aborted.
            await parent.removeEntry(tempZipName).catch(() => { });
            await parent.removeEntry(folderName, { recursive: true }).catch(() => { });
            throw error;
        }
    }
}

/**
 * Checks if a folder exists AND has the .ready marker inside it.
 */
export async function checkFolderExistsAndIsReady(
    parent: FileSystemDirectoryHandle,
    folderName: string
): Promise<boolean> {
    try {
        const dirHandle = await parent.getDirectoryHandle(folderName);
        await dirHandle.getFileHandle('.ready');
        return true; // Folder and marker both exist
    } catch {
        return false; // Either folder or marker is missing
    }
}

/**
 * Checks if a folder has the .ready marker inside it.
 */
export async function checkFolderIsReady(
    folder: FileSystemDirectoryHandle,
): Promise<boolean> {
    try {
        await folder.getFileHandle('.ready');
        return true; // Folder and marker both exist
    } catch {
        return false; // Either folder or marker is missing
    }
}

/**
 * A custom Writer for zip.js to pipe data directly to OPFS
 * Fully compliant with the zip.js Writer interface.
 */
class OPFSWriter implements Writer<void> {
    public size = 0;
    public writable: FileSystemWritableFileStream;
    private signal?: AbortSignal;

    constructor(writable: FileSystemWritableFileStream, signal?: AbortSignal) {
        this.writable = writable;
        this.signal = signal;
    }

    async writeUint8Array(array: Uint8Array) {
        // Immediately stop saving to disk if cancellation was requested
        if (this.signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');

        await this.writable.write(array as unknown as BufferSource);
        this.size += array.byteLength;
    }

    async getData() {
        await this.writable.close();
    }
}