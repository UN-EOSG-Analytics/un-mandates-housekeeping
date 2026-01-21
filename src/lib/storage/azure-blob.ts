import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// Environment variables required:
// AZURE_STORAGE_ACCOUNT_NAME - The storage account name
// AZURE_STORAGE_ACCOUNT_KEY - The storage account access key
// AZURE_STORAGE_CONTAINER_NAME - The container name for uploads (default: "docx-uploads")

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName =
  process.env.AZURE_STORAGE_CONTAINER_NAME || "docx-uploads";

if (!accountName || !accountKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY must be set",
    );
  }
}

let containerClient: ContainerClient | null = null;

function getContainerClient(): ContainerClient {
  if (containerClient) return containerClient;

  if (!accountName || !accountKey) {
    throw new Error("Azure Storage credentials not configured");
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  containerClient = blobServiceClient.getContainerClient(containerName);
  return containerClient;
}

/**
 * Ensure the container exists (call once on startup or first upload)
 */
export async function ensureContainer(): Promise<void> {
  const client = getContainerClient();
  await client.createIfNotExists({
    access: undefined, // private access
  });
}

/**
 * Upload a file to Azure Blob Storage
 * @param buffer - The file content as a Buffer
 * @param blobName - The name/path for the blob (e.g., "entity/2024/filename.docx")
 * @param contentType - MIME type of the file
 * @returns The full URL of the uploaded blob
 */
export async function uploadBlob(
  buffer: Buffer,
  blobName: string,
  contentType: string,
): Promise<{ url: string; blobName: string }> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });

  return {
    url: blockBlobClient.url,
    blobName,
  };
}

/**
 * Delete a blob from Azure Blob Storage
 * @param blobName - The name/path of the blob to delete
 */
export async function deleteBlob(blobName: string): Promise<void> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * Generate a unique blob name for an upload
 * @param entity - The entity the file is being uploaded for
 * @param originalFilename - The original filename
 * @returns A unique blob name with path structure
 */
export function generateBlobName(
  entity: string,
  originalFilename: string,
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedEntity = entity.replace(/[^a-zA-Z0-9-_]/g, "_");
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9-_.]/g, "_");

  return `${sanitizedEntity}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
}
