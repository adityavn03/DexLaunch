"use client";

import React, { useState, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";
import { Loader2, Send, AlertCircle, CheckCircle2, Coins, ArrowRight } from "lucide-react";

export default function SendToken() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const [mintAddress, setMintAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [decimals, setDecimals] = useState(9);

  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // ────────────────────────────────────────────────
  // Fetch token balance when mint address changes
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (wallet.publicKey && mintAddress.trim()) {
      checkBalance();
    } else {
      setTokenBalance(null);
    }
  }, [wallet.publicKey, mintAddress, decimals]);

  async function checkBalance() {
    if (!wallet.publicKey || !mintAddress.trim()) return;

    setCheckingBalance(true);
    setError(null);
    setTokenBalance(null);

    try {
      const mint = new PublicKey(mintAddress.trim());
      const ata = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const acc = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
      const bal = Number(acc.amount) / 10 ** decimals;
      setTokenBalance(bal);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("could not find account")) {
        setTokenBalance(0);
      } else {
        setError("Failed to load balance");
      }
    } finally {
      setCheckingBalance(false);
    }
  }

  // ────────────────────────────────────────────────
  // Send tokens logic (cleaned & improved error handling)
  // ────────────────────────────────────────────────
  async function sendTokens() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError("Wallet not connected");
      return;
    }
    if (!mintAddress || !recipientAddress || amount <= 0) {
      setError("Please fill all required fields");
      return;
    }
    if (tokenBalance !== null && amount > tokenBalance) {
      setError("Insufficient token balance");
      return;
    }

    setLoading(true);
    setError(null);
    setTxSig(null);
    setStatus("Preparing transaction...");

    try {
      const mint = new PublicKey(mintAddress.trim());
      const recipient = new PublicKey(recipientAddress.trim());

      const senderATA = getAssociatedTokenAddressSync(mint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
      const recipientATA = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_2022_PROGRAM_ID);

      const tx = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Create recipient ATA if needed
      try {
        await getAccount(connection, recipientATA, "confirmed", TOKEN_2022_PROGRAM_ID);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientATA,
            recipient,
            mint,
            TOKEN_2022_PROGRAM_ID
          )
        );
      }

      // Transfer
      const uiAmount = amount;
      const rawAmount = BigInt(Math.floor(uiAmount * 10 ** decimals));

      tx.add(
        createTransferInstruction(
          senderATA,
          recipientATA,
          wallet.publicKey,
          rawAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      setStatus("Approve in wallet...");

      const signed = await wallet.signTransaction(tx);

      setStatus("Broadcasting...");

      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      setTxSig(sig);

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setStatus("Tokens sent successfully!");
      setAmount(0);
      setTimeout(checkBalance, 3000); // refresh balance
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Transfer failed";

      if (err.message?.includes("User rejected")) msg = "Transaction rejected";
      else if (err.message?.includes("insufficient funds")) msg = "Not enough SOL for fees";
      else if (err.message?.includes("blockhash")) msg = "Transaction expired";

      setError(msg);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  const explorerUrl = txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/30 to-gray-950 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Send className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Send Tokens</h2>
            <p className="mt-2 text-gray-400">Transfer SPL Token-2022 to any wallet</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Mint Address */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Token Mint Address
              </label>
              <input
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value.trim())}
                placeholder="e.g. 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
                disabled={loading}
                className="
                  w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                  text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                  disabled:opacity-50 font-mono text-sm
                "
              />
            </div>

            {/* Decimals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Decimals
                </label>
                <input
                  type="number"
                  value={decimals}
                  onChange={(e) => setDecimals(Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
                  min={0}
                  max={18}
                  disabled={loading}
                  className="
                    w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                    text-white focus:outline-none focus:border-emerald-500/50
                    disabled:opacity-50
                  "
                />
              </div>

              {/* Balance Display */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">
                  Your Balance
                </label>
                <div className="h-12 flex items-center px-4 bg-black/30 rounded-xl border border-white/5">
                  {checkingBalance ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  ) : tokenBalance !== null ? (
                    <span className="text-lg font-semibold text-emerald-400">
                      {tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">—</span>
                  )}
                  <Coins className="w-4 h-4 ml-2 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Recipient Address
              </label>
              <input
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value.trim())}
                placeholder="Solana wallet address"
                disabled={loading}
                className="
                  w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                  text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                  disabled:opacity-50 font-mono text-sm
                "
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Amount to Send
              </label>
              <input
                type="number"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                placeholder="0.0"
                min={0}
                step="any"
                disabled={loading || tokenBalance === null}
                className="
                  w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                  text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                  disabled:opacity-50
                "
              />

              {/* Quick send buttons */}
              {tokenBalance !== null && tokenBalance > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {[0.25, 0.5, 1].map((pct) => {
                    const val = (tokenBalance * pct).toFixed(6);
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setAmount(Number(val))}
                        disabled={loading}
                        className="
                          px-4 py-1.5 text-sm rounded-lg border border-emerald-500/30
                          bg-emerald-950/30 hover:bg-emerald-800/40 text-emerald-300
                          transition disabled:opacity-50
                        "
                      >
                        {pct === 1 ? "Max" : `${pct * 100}%`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status / Success */}
            {status && (
              <div className="p-4 bg-gray-900/50 rounded-xl text-center text-gray-300 text-sm">
                {status}
              </div>
            )}

            {txSig && (
              <div className="p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-emerald-300 font-medium mb-4">Transfer Complete!</p>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center gap-2 px-6 py-3
                      bg-emerald-800/60 hover:bg-emerald-700/60 rounded-lg
                      text-emerald-100 transition
                    "
                  >
                    View on Explorer
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={sendTokens}
              disabled={
                loading ||
                !mintAddress ||
                !recipientAddress ||
                amount <= 0 ||
                (tokenBalance !== null && amount > tokenBalance)
              }
              className={`
                w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3
                transition-all duration-300 shadow-lg
                ${loading || !mintAddress || !recipientAddress || amount <= 0 || (tokenBalance !== null && amount > tokenBalance)
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 hover:scale-[1.02] text-white"
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send Tokens
                  <Send className="w-5 h-5" />
                </>
              )}
            </button>

            {!wallet.connected && !error && (
              <p className="text-center text-gray-400 text-sm pt-2">
                Connect your wallet to send tokens
              </p>
            )}
          </div>

          {/* Tips footer */}
          <div className="px-6 py-5 bg-black/30 border-t border-white/5 text-xs text-gray-500">
            • Creating a token account for the recipient costs ~0.002 SOL (if needed)<br />
            • Always double-check the recipient address<br />
            • Ensure sufficient SOL for fees (~0.000005–0.001 SOL)
          </div>
        </div>
      </div>
    </div>
  );
}