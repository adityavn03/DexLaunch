/* ================================
   PINATA FILE UPLOAD
================================ */

export const uploadFileToPinata = async (
  file: File,
  pinataJwt: string
) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Pinata file upload failed`);
    }

    const data = await response.json();

    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  } catch (error) {
    console.error("Pinata File Upload Error:", error);
    throw error;
  }
};

/* ================================
   PINATA JSON UPLOAD
================================ */

export const uploadJsonToPinata = async (
  json: any,
  pinataJwt: string
) => {
  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: JSON.stringify({
          pinataContent: json,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Pinata JSON upload failed`);
    }

    const data = await response.json();

    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  } catch (error) {
    console.error("Pinata JSON Upload Error:", error);
    throw error;
  }
};
