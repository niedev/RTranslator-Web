interface DirectoryItem {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
}

export async function listDirectoryChildren(dirHandle: FileSystemDirectoryHandle): Promise<DirectoryItem[]> {
    const children: DirectoryItem[] = [];

    // Iterate over all entries in the directory
    for await (const [name, handle] of dirHandle.entries()) {
        children.push({
            name,
            kind: handle.kind,
            handle
        });
    }

    return children;
}

/**
 * This method will return only the internal folders that have a .ready file inside it (the marker we use to indicate a finished download with no problem)
 * @param dirHandle 
 * @returns 
 */
export async function listDirectoryChildrenReady(dirHandle: FileSystemDirectoryHandle): Promise<DirectoryItem[]> {
    const children: DirectoryItem[] = [];

    // Iterate over all entries in the directory
    for await (const [name, handle] of dirHandle.entries()) {
        try {
            if(handle instanceof FileSystemDirectoryHandle){
                await handle.getFileHandle('.ready');
                children.push({
                    name,
                    kind: handle.kind,
                    handle
                });
            }
        } catch {
            // Either folder or marker is missing
        }
    }

    return children;
}