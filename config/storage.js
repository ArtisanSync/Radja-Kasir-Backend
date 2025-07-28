import ImageKit from "imagekit";

let imagekit;
let storageEnabled = false;

try {
  const missingVars = [];
  if (!process.env.IMAGEKIT_PUBLIC_KEY) missingVars.push("IMAGEKIT_PUBLIC_KEY");
  if (!process.env.IMAGEKIT_PRIVATE_KEY)
    missingVars.push("IMAGEKIT_PRIVATE_KEY");
  if (!process.env.IMAGEKIT_URL_ENDPOINT)
    missingVars.push("IMAGEKIT_URL_ENDPOINT");
  if (missingVars.length > 0) {
    console.warn(
      `Konfigurasi ImageKit tidak lengkap. Yang kurang: ${missingVars.join(
        ", "
      )}. Fitur Storage akan dinonaktifkan.`
    );
  } else {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
    storageEnabled = true;
    console.log(
      "ImageKit berhasil diinisialisasi dengan endpoint:",
      process.env.IMAGEKIT_URL_ENDPOINT
    );
  }
} catch (error) {
  console.error("Error saat menginisialisasi ImageKit:", error);
  console.error("Fitur Storage akan dinonaktifkan");
}

export const uploadProductImageToStorage = async (
  imageBase64,
  storeId,
  productUuid,
  productName
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!imageBase64) {
      throw new Error("Image base64 diperlukan");
    }
    const cleanProductName = productName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    const fileName = `product_${productUuid}_${cleanProductName}_${Date.now()}`;
    const folderPath = `/products/store_${storeId}`;
    const uploadResponse = await imagekit.upload({
      file: imageBase64,
      fileName: fileName,
      folder: folderPath,
      tags: ["product", `store_${storeId}`, `uuid_${productUuid}`],
      useUniqueFileName: true,
      transformation: {
        pre: "w-800,h-600,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload produk ke ImageKit:", error);
    throw error;
  }
};

export const uploadProductVariantImageToStorage = async (
  imageBase64,
  storeId,
  productUuid,
  variantId,
  variantName
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!imageBase64) {
      throw new Error("Image base64 diperlukan");
    }
    const cleanVariantName = variantName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    const fileName = `variant_${variantId}_${cleanVariantName}_${Date.now()}`;
    const folderPath = `/products/store_${storeId}/variants`;
    const uploadResponse = await imagekit.upload({
      file: imageBase64,
      fileName: fileName,
      folder: folderPath,
      tags: [
        "variant",
        `store_${storeId}`,
        `product_${productUuid}`,
        `variant_${variantId}`,
      ],
      useUniqueFileName: true,
      transformation: {
        pre: "w-600,h-450,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload variant produk ke ImageKit:", error);
    throw error;
  }
};

export const uploadStoreLogoToStorage = async (
  logoBase64,
  storeId,
  storeUuid,
  storeName
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!logoBase64) {
      throw new Error("Logo base64 diperlukan");
    }
    const cleanStoreName = storeName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    const fileName = `logo_${storeUuid}_${cleanStoreName}_${Date.now()}`;
    const folderPath = `/stores/store_${storeId}/logo`;
    const uploadResponse = await imagekit.upload({
      file: logoBase64,
      fileName: fileName,
      folder: folderPath,
      tags: ["logo", `store_${storeId}`, `uuid_${storeUuid}`],
      useUniqueFileName: true,
      transformation: {
        pre: "w-300,h-300,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload logo toko ke ImageKit:", error);
    throw error;
  }
};

export const uploadStoreStampToStorage = async (
  stampBase64,
  storeId,
  storeUuid,
  storeName
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!stampBase64) {
      throw new Error("Stamp base64 diperlukan");
    }
    const cleanStoreName = storeName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    const fileName = `stamp_${storeUuid}_${cleanStoreName}_${Date.now()}`;
    const folderPath = `/stores/store_${storeId}/stamp`;
    const uploadResponse = await imagekit.upload({
      file: stampBase64,
      fileName: fileName,
      folder: folderPath,
      tags: ["stamp", `store_${storeId}`, `uuid_${storeUuid}`],
      useUniqueFileName: true,
      transformation: {
        pre: "w-400,h-400,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload stamp toko ke ImageKit:", error);
    throw error;
  }
};

export const uploadPostThumbnailToStorage = async (
  thumbnailBase64,
  postId,
  postSlug,
  authorId
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!thumbnailBase64) {
      throw new Error("Thumbnail base64 diperlukan");
    }
    const cleanSlug = postSlug.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const fileName = `thumbnail_${postId}_${cleanSlug}_${Date.now()}`;
    const folderPath = `/posts/author_${authorId}`;
    const uploadResponse = await imagekit.upload({
      file: thumbnailBase64,
      fileName: fileName,
      folder: folderPath,
      tags: ["thumbnail", `post_${postId}`, `author_${authorId}`, postSlug],
      useUniqueFileName: true,
      transformation: {
        pre: "w-800,h-450,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload thumbnail post ke ImageKit:", error);
    throw error;
  }
};

export const uploadOrderDocumentToStorage = async (
  documentBase64,
  orderId,
  orderUuid,
  storeId,
  documentType = "invoice"
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!documentBase64) {
      throw new Error("Document base64 diperlukan");
    }
    const fileName = `${documentType}_${orderUuid}_${Date.now()}`;
    const folderPath = `/orders/store_${storeId}/${documentType}`;
    const uploadResponse = await imagekit.upload({
      file: documentBase64,
      fileName: fileName,
      folder: folderPath,
      tags: [
        documentType,
        `order_${orderId}`,
        `store_${storeId}`,
        `uuid_${orderUuid}`,
      ],
      useUniqueFileName: true,
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload dokumen order ke ImageKit:", error);
    throw error;
  }
};

export const uploadCustomerPhotoToStorage = async (
  photoBase64,
  customerId,
  storeId,
  customerName
) => {
  try {
    if (!storageEnabled) {
      throw new Error("Storage tidak diaktifkan");
    }
    if (!photoBase64) {
      throw new Error("Photo base64 diperlukan");
    }
    const cleanCustomerName = customerName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    const fileName = `customer_${customerId}_${cleanCustomerName}_${Date.now()}`;
    const folderPath = `/customers/store_${storeId}`;
    const uploadResponse = await imagekit.upload({
      file: photoBase64,
      fileName: fileName,
      folder: folderPath,
      tags: ["customer", `customer_${customerId}`, `store_${storeId}`],
      useUniqueFileName: true,
      transformation: {
        pre: "w-300,h-300,c-maintain_ratio",
      },
    });
    return uploadResponse.url;
  } catch (error) {
    console.error("Error saat upload foto customer ke ImageKit:", error);
    throw error;
  }
};

export async function deleteFileFromStorage(imageUrl) {
  try {
    if (!storageEnabled || !imageUrl) {
      return;
    }
    let fileId = "";
    if (imageUrl.includes("ik.imagekit.io")) {
      const urlParts = imageUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const listResponse = await imagekit.listFiles({
        name: fileName.split("?")[0],
        limit: 1,
      });
      if (listResponse && listResponse.length > 0) {
        fileId = listResponse[0].fileId;
      }
    }
    if (!fileId) {
      console.error("Tidak dapat mengekstrak fileId dari URL:", imageUrl);
      return;
    }
    const deleteResponse = await imagekit.deleteFile(fileId);
    console.log(`File ${fileId} berhasil dihapus dari ImageKit`);
    return deleteResponse;
  } catch (error) {
    console.error("Error di deleteFileFromStorage:", error);
    throw error;
  }
}

export const getTransformedUrl = (imageUrl, transformations) => {
  if (!storageEnabled || !imageUrl) {
    return imageUrl;
  }
  try {
    const transformedUrl = imagekit.url({
      src: imageUrl,
      transformation: transformations,
    });
    return transformedUrl;
  } catch (error) {
    console.error("Error saat membuat transformed URL:", error);
    return imageUrl;
  }
};

export const listFilesByTags = async (tags, limit = 100, skip = 0) => {
  try {
    if (!storageEnabled) {
      return [];
    }
    const listResponse = await imagekit.listFiles({
      tags: tags.join(","),
      limit,
      skip,
    });
    return listResponse || [];
  } catch (error) {
    console.error("Error saat list files:", error);
    throw error;
  }
};

export async function testStorageConnection() {
  if (!storageEnabled) {
    return false;
  }
  try {
    await imagekit.listFiles({ limit: 1 });
    return true;
  } catch (error) {
    return false;
  }
}

testStorageConnection().then((result) => {
  console.log(`Status koneksi ImageKit: ${result ? "OK" : "ERROR"}`);
});

export const uploadPhotoToStorage = uploadOrderDocumentToStorage;
export const deletePhotoFromStorage = deleteFileFromStorage;
export const isEnabled = () => storageEnabled;
export { imagekit };
