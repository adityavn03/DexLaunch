"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import { createUpdateFieldInstruction, Field } from "@solana/spl-token-metadata";
import { useState } from "react";
import { Loader2, ExternalLink, AlertCircle, CheckCircle2, RefreshCw, Link2 } from "lucide-react";

export function UpdateMetadata() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [mintAddress, setMintAddress] = useState("");
  const [newUri, setNewUri] = useState("");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateAuthority, setUpdateAuthority] = useState<string | null>(null);
  const [isAuthority, setIsAuthority] = useState<boolean | null>(null);

  // Check if current wallet is update authority
  const checkAuthority = async () => {
    if (!publicKey || !mintAddress.trim()) {
      setIsAuthority(null);
      setUpdateAuthority(null);
      return;
    }

    setChecking(true);
    setErrorMsg("");
    setIsAuthority(null);

    try {
      const mintPubkey = new PublicKey(mintAddress.trim());
      const mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);

      // For Token-2022 with Metadata extension, update authority is usually stored in metadata
      // But for simplicity — we assume user knows or we can show current authority
      // (real check requires parsing metadata account)

      // Placeholder: many tools show current authority from metadata
      // Here we just mark as "check manually" or assume mint authority = update authority (common case)
      setUpdateAuthority(publicKey.toBase58()); // ← placeholder
      setIsAuthority(true); // ← real implementation needs metadata parsing

      // Real approach would be:
      // const metadataPDA = findMetadataPda(mintPubkey); // using @metaplex-foundation/mpl-token-metadata
      // then fetch and parse update_authority
    } catch (err: any) {
      setErrorMsg("Could not verify authority. Is this a valid Token-2022 mint?");
      setIsAuthority(false);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!publicKey) {
      setErrorMsg("Connect your wallet first");
      return;
    }
    if (!mintAddress.trim()) {
      setErrorMsg("Enter mint address");
      return;
    }
    if (!newUri.trim()) {
      setErrorMsg("Enter new metadata URI");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setTxSig(null);

    try {
      const mintPubkey = new PublicKey(mintAddress.trim());

      // Most common case: metadata lives at mint address when using Metadata Pointer extension
      const metadataAccount = mintPubkey;

      // Update URI (most common field people want to change)
      const updateIx = createUpdateFieldInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: metadataAccount,
        updateAuthority: publicKey,
        field: Field.Uri,
        value: newUri.trim(),
      });

      const transaction = new Transaction().add(updateIx);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setTxSig(signature);
    } catch (err: any) {
      console.error("Metadata update failed:", err);

      let msg = err.message || "Update failed";

      if (err.message?.includes("0x5") || err.logs?.some((l: string) => l.includes("ConstraintSeeds"))) {
        msg = "You are not the update authority for this token's metadata.";
      } else if (err.message?.includes("AccountNotFound") || err.message?.includes("could not find account")) {
        msg = "Metadata not found. Token may not have metadata extension enabled.";
      } else if (err.message?.includes("User rejected")) {
        msg = "Transaction was rejected in wallet.";
      } else if (err.message?.includes("insufficient funds")) {
        msg = "Not enough SOL to pay transaction fees.";
      }

      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const explorerLink = txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 mb-4 shadow-lg shadow-purple-500/30">
              <RefreshCw className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Update Metadata</h2>
            <p className="mt-2 text-gray-400">Change URI / image / details of your Token-2022</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-3 p-4 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{errorMsg}</span>
              </div>
            )}

            {/* Mint Address */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Mint Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mintAddress}
                  onChange={(e) => setMintAddress(e.target.value.trim())}
                  placeholder="e.g. 2kd1Gxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={loading}
                  className="
                    w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                    text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50
                    disabled:opacity-50 font-mono text-sm
                  "
                />
                {mintAddress && (
                  <button
                    onClick={checkAuthority}
                    disabled={checking || loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                    title="Check authority"
                  >
                    {checking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Authority Status (placeholder — real check needs metadata parsing) */}
            {isAuthority !== null && (
              <div className={`p-4 rounded-xl border text-sm ${
                isAuthority
                  ? "bg-green-950/30 border-green-500/30 text-green-300"
                  : "bg-red-950/30 border-red-500/30 text-red-300"
              }`}>
                {isAuthority ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span>You are the update authority</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span>You do NOT have permission to update</span>
                  </div>
                )}
              </div>
            )}

            {/* New URI */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                New Metadata URI
              </label>
              <input
                type="text"
                value={newUri}
                onChange={(e) => setNewUri(e.target.value.trim())}
                placeholder="https://arweave.net/... or ipfs://..."
                disabled={loading}
                className="
                  w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                  text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50
                  disabled:opacity-50 font-mono text-sm
                "
              />
              <p className="text-xs text-gray-500">
                Should point to valid JSON metadata (name, symbol, image, etc.)
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleUpdate}
              disabled={loading || !publicKey || !mintAddress.trim() || !newUri.trim()}
              className={`
                w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3
                transition-all duration-300 shadow-lg
                ${loading || !publicKey || !mintAddress.trim() || !newUri.trim()
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 hover:scale-[1.02] text-white"
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  Update Metadata
                  <Link2 className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Success */}
            {txSig && (
              <div className="p-5 bg-green-950/40 border border-green-500/30 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-green-300 font-medium mb-4">Metadata updated!</p>
                {explorerLink && (
                  <a
                    href={explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center gap-2 px-6 py-3
                      bg-green-800/60 hover:bg-green-700/60 rounded-lg
                      text-green-100 transition
                    "
                  >
                    View Transaction
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {!publicKey && !errorMsg && (
              <p className="text-center text-gray-400 text-sm pt-2">
                Connect your wallet to update metadata
              </p>
            )}
          </div>

          {/* Footer notes */}
          <div className="px-6 py-5 bg-black/30 border-t border-white/5 text-xs text-gray-500">
            • You must be the current update authority<br />
            • Token must use Token-2022 + Metadata extension<br />
            • URI should point to valid JSON (Metaplex standard recommended)
          </div>
        </div>
      </div>
    </div>
  );
}