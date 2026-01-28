"use client";

import React, { useState } from "react";
import {
  Keypair,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import { Loader2, Upload, X, CheckCircle2, Copy, ExternalLink, Rocket, Image as ImageIcon } from "lucide-react";



const uploadFileToPinata = async (file: File, pinataJwt: string) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: formData,
  });

  if (!response.ok) throw new Error(`Pinata upload failed: ${response.statusText}`);
  const data = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
};

const uploadJsonToPinata = async (json: any, pinataJwt: string) => {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({ pinataContent: json }),
  });

  if (!response.ok) throw new Error(`Pinata JSON failed: ${response.statusText}`);
  const data = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
};

// ────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────

export default function TokenLaunchpad() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0 = form, 1 = uploading, 2 = tx1, 3 = tx2, 4 = tx3, 5 = success
  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
  };


  async function createToken() {
    if (!wallet.publicKey || !wallet.signTransaction) return setError("Wallet not connected");
    if (!PINATA_JWT) return setError("Pinata JWT missing in environment");
    if (!name || !symbol || amount <= 0 || !imageFile) return setError("Fill all required fields");

    setLoading(true);
    setError(null);
    setMintAddress(null);
    setTxSig(null);
    setStep(1);

    try {
      const bal = await connection.getBalance(wallet.publicKey);
      if (bal < 0.05 * 1e9) throw new Error(`Low SOL balance: ${(bal / 1e9).toFixed(4)} SOL`);

      setStatus("Uploading image to IPFS...");
      setStep(1);
      const imageUrl = await uploadFileToPinata(imageFile, PINATA_JWT);

      setStatus("Preparing & uploading metadata...");
      setStep(1.5);
      const metadata = {
        name,
        symbol,
        description: description || `${name} (${symbol}) token on Solana`,
        image: imageUrl,
        attributes: [],
        properties: { files: [{ uri: imageUrl, type: imageFile.type }], category: "fungible" },
      };
      const metadataUri = await uploadJsonToPinata(metadata, PINATA_JWT);

      setStatus("Preparing mint account...");
      setStep(2);
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey;

      const tokenMeta: TokenMetadata = {
        mint,
        name,
        symbol,
        uri: metadataUri,
        additionalMetadata: description ? [["description", description]] : [],
      };

      const metadataLen = pack(tokenMeta).length;
      const metadataExt = TYPE_SIZE + LENGTH_SIZE;
      const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
      const totalSpace = mintSpace + metadataLen + metadataExt;

      const rent = await connection.getMinimumBalanceForRentExemption(totalSpace);

      // ====== TRANSACTION 1: Create Mint ======
      setStatus("Creating mint account (Tx 1/3)...");
      setStep(2);
      const tx1 = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mint,
          space: mintSpace,
          lamports: rent,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(mint, wallet.publicKey, mint, TOKEN_2022_PROGRAM_ID),
        createInitializeMintInstruction(mint, 9, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
        createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          metadata: mint,
          updateAuthority: wallet.publicKey,
          mint,
          mintAuthority: wallet.publicKey,
          name,
          symbol,
          uri: metadataUri,
        })
      );

      const { blockhash: bh1, lastValidBlockHeight: lh1 } = await connection.getLatestBlockhash();
      tx1.recentBlockhash = bh1;
      tx1.feePayer = wallet.publicKey;
      tx1.partialSign(mintKeypair);

      setStatus("Approve Tx 1 in wallet...");
      const signed1 = await wallet.signTransaction(tx1);
      
      // Send with skipPreflight to avoid double submission
      const sig1 = await connection.sendRawTransaction(signed1.serialize(), { 
        skipPreflight: true,
        maxRetries: 0 // Don't auto-retry, we'll handle manually
      });
      
      // Confirm with proper error handling
      const confirmation1 = await connection.confirmTransaction(
        { signature: sig1, blockhash: bh1, lastValidBlockHeight: lh1 }, 
        "confirmed"
      );
      
      if (confirmation1.value.err) {
        throw new Error(`Transaction 1 failed: ${JSON.stringify(confirmation1.value.err)}`);
      }

      // ====== TRANSACTION 2: Create ATA ======
      setStatus("Creating your token account (Tx 2/3)...");
      setStep(3);
      const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
      const tx2 = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, mint, TOKEN_2022_PROGRAM_ID)
      );

      const { blockhash: bh2, lastValidBlockHeight: lh2 } = await connection.getLatestBlockhash();
      tx2.recentBlockhash = bh2;
      tx2.feePayer = wallet.publicKey;

      setStatus("Approve Tx 2 in wallet...");
      const signed2 = await wallet.signTransaction(tx2);
      
      const sig2 = await connection.sendRawTransaction(signed2.serialize(), { 
        skipPreflight: true,
        maxRetries: 0
      });
      
      const confirmation2 = await connection.confirmTransaction(
        { signature: sig2, blockhash: bh2, lastValidBlockHeight: lh2 }, 
        "confirmed"
      );
      
      if (confirmation2.value.err) {
        throw new Error(`Transaction 2 failed: ${JSON.stringify(confirmation2.value.err)}`);
      }

      // ====== TRANSACTION 3: Mint Tokens ======
      setStatus("Minting initial supply (Tx 3/3)...");
      setStep(4);
      const rawAmount = BigInt(amount) * BigInt(1_000_000_000);
      const tx3 = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        createMintToInstruction(mint, ata, wallet.publicKey, rawAmount, [], TOKEN_2022_PROGRAM_ID)
      );

      const { blockhash: bh3, lastValidBlockHeight: lh3 } = await connection.getLatestBlockhash();
      tx3.recentBlockhash = bh3;
      tx3.feePayer = wallet.publicKey;

      setStatus("Approve Tx 3 in wallet...");
      const signed3 = await wallet.signTransaction(tx3);
      
      const sig3 = await connection.sendRawTransaction(signed3.serialize(), { 
        skipPreflight: true,
        maxRetries: 0
      });
      
      const confirmation3 = await connection.confirmTransaction(
        { signature: sig3, blockhash: bh3, lastValidBlockHeight: lh3 }, 
        "confirmed"
      );
      
      if (confirmation3.value.err) {
        throw new Error(`Transaction 3 failed: ${JSON.stringify(confirmation3.value.err)}`);
      }

      setMintAddress(mint.toBase58());
      setTxSig(sig3);
      setStatus("Token launched successfully!");
      setStep(5);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Creation failed";
      if (msg.includes("insufficient funds")) msg = "Not enough SOL (~0.05+ SOL needed)";
      else if (msg.includes("User rejected")) msg = "Transaction rejected";
      else if (msg.includes("already been processed")) msg = "Transaction already processed - check your wallet";
      setError(msg);
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  const copyMint = () => {
    if (mintAddress) navigator.clipboard.writeText(mintAddress);
  };

  const explorerMint = mintAddress ? `https://explorer.solana.com/address/${mintAddress}?cluster=devnet` : "";
  const explorerTx = txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/40 to-gray-950 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-indigo-900/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Token Launchpad</h2>
            <p className="mt-2 text-gray-400">Create your Token-2022 with metadata on IPFS</p>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300">
                <X className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Progress Steps */}
            <div className="flex justify-between px-2">
              {["Details", "Image", "Launch"].map((label, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all ${
                      step >= i + 1
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : step === i
                        ? "border-indigo-400 text-indigo-400 animate-pulse"
                        : "border-gray-600 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs mt-1 text-gray-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Form - only show when step < 2 */}
            {step < 2 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Token Name *</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. BitCoin Coin"
                      disabled={loading}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Symbol *</label>
                    <input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. BTC"
                      maxLength={10}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What makes your token special?"
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Initial Supply *</label>
                  <input
                    type="number"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="1,000,000"
                    min={1}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Token Image *</label>
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={loading}
                        className="hidden"
                        id="token-image"
                      />
                      <label htmlFor="token-image" className="cursor-pointer">
                        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-300">Click or drag image here</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, max 4MB recommended</p>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-white/10">
                      <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                      <button
                        onClick={removeImage}
                        disabled={loading}
                        className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-red-400 hover:bg-red-900/60 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Status / Loading */}
            {(loading || status) && (
              <div className="p-5 bg-black/50 rounded-xl border border-white/5 text-center">
                {loading && <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />}
                <p className="text-gray-300">{status || "Preparing launch..."}</p>
                {step >= 2 && step < 5 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Step {Math.ceil(step)}/3 • This may take 10–30 seconds
                  </p>
                )}
              </div>
            )}

            {/* Success */}
            {step === 5 && mintAddress && (
              <div className="p-6 bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-500/30 rounded-xl text-center">
                <CheckCircle2 className="w-16 h-16 text-indigo-400 mx-auto mb-4" />

                <h3 className="text-2xl font-bold text-white mb-2">
                  Token Launched!
                </h3>

                <p className="text-gray-300 mb-6">
                  Your {name} ({symbol}) is now live on Solana
                </p>

                <div className="bg-black/40 p-4 rounded-lg mb-6 font-mono text-sm break-all text-left">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Mint Address</span>
                    <button
                      onClick={copyMint}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      <Copy className="w-4 h-4 inline" />
                    </button>
                  </div>
                  {mintAddress}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={explorerMint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition"
                  >
                    View Mint on Explorer
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {txSig && (
                    <a
                      href={explorerTx}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600/80 hover:bg-green-700 rounded-lg text-white transition"
                    >
                      View Tx
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-6">
                  Metadata & image may take 1–5 minutes to appear on explorers
                </p>
              </div>
            )}

            {/* Create Button */}
            {step < 2 && (
              <button
                onClick={createToken}
                disabled={loading || !name || !symbol || amount <= 0 || !imageFile}
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3
                  transition-all duration-300 shadow-lg
                  ${loading || !name || !symbol || amount <= 0 || !imageFile
                    ? "bg-gray-700 cursor-not-allowed text-gray-400"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 hover:scale-[1.02] text-white"
                  }
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    Launch Token
                    <Rocket className="w-5 h-5" />
                  </>
                )}
              </button>
            )}

            {!wallet.connected && step < 2 && !error && (
              <p className="text-center text-gray-400 text-sm">
                Connect your wallet to create a token
              </p>
            )}
          </div>

          {/* Footer note */}
          <div className="px-6 py-5 bg-black/30 border-t border-white/5 text-xs text-gray-500 text-center">
            • ~0.03–0.08 SOL needed (rent + fees)<br />
            • Image & metadata stored permanently on IPFS via Pinata
          </div>
        </div>
      </div>
    </div>
  );
}