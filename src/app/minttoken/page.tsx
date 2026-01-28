"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight, Coins } from "lucide-react";

export default function MintTokens() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [decimals, setDecimals] = useState<number>(9);
  const [loading, setLoading] = useState(false);
  const [mintAmount, setMintAmount] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMintAddress, setTokenMintAddress] = useState<string>("");
  const [isMintAuthority, setIsMintAuthority] = useState<boolean | null>(null);
  const [mintAuthority, setMintAuthority] = useState<string | null>(null);
  const [checkingAuthority, setCheckingAuthority] = useState(false);

  // ────────────────────────────────────────────────
  // Check mint authority & balance
  // ────────────────────────────────────────────────
  const checkMintAuthority = async () => {
    if (!publicKey || !tokenMintAddress.trim()) return;

    setCheckingAuthority(true);
    setError(null);
    setIsMintAuthority(null);
    setMintAuthority(null);
    setBalance(null);

    try {
      let mintPubkey: PublicKey;
      try {
        mintPubkey = new PublicKey(tokenMintAddress.trim());
      } catch {
        setError("Invalid mint address format");
        return;
      }

      const mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);

      setDecimals(mintInfo.decimals);
      const authority = mintInfo.mintAuthority?.toBase58() ?? null;
      setMintAuthority(authority);

      const isAuth = mintInfo.mintAuthority?.equals(publicKey) ?? false;
      setIsMintAuthority(isAuth);

      if (!isAuth) {
        setError(authority 
          ? `You are not the mint authority (current: ${authority.slice(0,6)}...${authority.slice(-4)})`
          : "Mint authority is revoked / frozen");
      }

      // Try to get user's ATA balance
      try {
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);
        const acc = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
        setBalance(Number(acc.amount) / 10 ** mintInfo.decimals);
      } catch {
        setBalance(0);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message?.includes("could not find account") 
        ? "Token mint not found"
        : err.message || "Failed to load mint info");
    } finally {
      setCheckingAuthority(false);
    }
  };

  useEffect(() => {
    if (publicKey && tokenMintAddress) checkMintAuthority();
  }, [publicKey, tokenMintAddress]);

  // ────────────────────────────────────────────────
  // Mint logic
  // ────────────────────────────────────────────────
  const handleMint = async () => {
    if (!publicKey) return setError("Wallet not connected");
    if (!isMintAuthority) return setError("Not mint authority");
    if (!mintAmount || Number(mintAmount) <= 0) return setError("Enter valid amount");

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const mintPubkey = new PublicKey(tokenMintAddress.trim());
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);

      const tx = new Transaction();

      // Create ATA if missing
      try {
        await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            ata,
            publicKey,
            mintPubkey,
            TOKEN_2022_PROGRAM_ID
          )
        );
      }

      const amountUi = Number(mintAmount);
      const baseAmount = BigInt(Math.floor(amountUi * 10 ** decimals));

      tx.add(
        createMintToInstruction(
          mintPubkey,
          ata,
          publicKey,
          baseAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);
      setTxSignature(sig);

      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      setMintAmount("");
      await checkMintAuthority(); // refresh balance
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Mint failed";

      if (err.message?.includes("0x5")) msg = "Not mint authority";
      else if (err.message?.includes("insufficient funds")) msg = "Insufficient SOL for fees";
      else if (err.message?.includes("User rejected")) msg = "Transaction rejected";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const explorerLink = txSignature 
    ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet` 
    : null; // ← change to mainnet / custom cluster if needed

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/40 to-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 mb-4 shadow-lg shadow-purple-500/30">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Mint Tokens</h2>
            <p className="mt-2 text-gray-400">Issue new supply to your wallet</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Error / Status */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Mint Address Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Token Mint Address
              </label>
              <input
                type="text"
                value={tokenMintAddress}
                onChange={(e) => setTokenMintAddress(e.target.value)}
                placeholder="Enter mint address (base58)"
                disabled={loading || !publicKey}
                className="
                  w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                  text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                  font-mono text-sm
                "
              />
              {checkingAuthority && (
                <div className="flex items-center gap-2 text-purple-400 text-sm mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying mint authority...
                </div>
              )}
            </div>

            {/* Authority Status Card */}
            {isMintAuthority !== null && tokenMintAddress && (
              <div className={`
                p-5 rounded-xl border 
                ${isMintAuthority 
                  ? "bg-green-950/30 border-green-500/30 text-green-300" 
                  : "bg-red-950/30 border-red-500/30 text-red-300"}
              `}>
                <div className="flex items-center gap-3 mb-2">
                  {isMintAuthority ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <strong className="text-base">
                    {isMintAuthority ? "You control this mint" : "No minting permission"}
                  </strong>
                </div>
                {mintAuthority && (
                  <p className="text-xs text-gray-400 font-mono break-all">
                    Authority: {mintAuthority}
                  </p>
                )}
              </div>
            )}

            {/* Balance & Decimals */}
            {balance !== null && isMintAuthority && (
              <div className="grid grid-cols-2 gap-4 p-5 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <div className="text-sm text-gray-400">Your Balance</div>
                  <div className="text-2xl font-bold text-purple-300 mt-1">
                    {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Decimals</div>
                  <div className="text-xl font-semibold text-gray-200 mt-1">{decimals}</div>
                </div>
              </div>
            )}

            {/* Mint Amount */}
            {isMintAuthority && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Amount to Mint
                </label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  min="0"
                  step="any"
                  disabled={loading || !publicKey}
                  className="
                    w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl
                    text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50
                    disabled:opacity-50
                  "
                />

                {/* Quick amounts */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {[100, 1000, 10000, 100000, 1000000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMintAmount(val.toString())}
                      disabled={loading}
                      className="
                        px-4 py-2 text-sm rounded-lg border border-purple-500/30
                        bg-purple-950/30 hover:bg-purple-800/40 text-purple-300
                        transition disabled:opacity-40
                      "
                    >
                      {val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleMint}
              disabled={loading || !publicKey || !isMintAuthority || !mintAmount || Number(mintAmount) <= 0}
              className={`
                w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3
                transition-all duration-300 shadow-lg
                ${loading || !publicKey || !isMintAuthority || !mintAmount || Number(mintAmount) <= 0
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 hover:scale-[1.02] text-white"
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  Mint Tokens
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Tx Success */}
            {txSignature && (
              <div className="p-5 bg-green-950/30 border border-green-500/30 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-green-300 font-medium mb-3">Tokens minted successfully!</p>
                <a
                  href={explorerLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-2 px-5 py-2.5 
                    bg-green-800/50 hover:bg-green-700/50 rounded-lg text-green-200 text-sm
                    transition
                  "
                >
                  View on Explorer
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}

            {!publicKey && !error && (
              <p className="text-center text-gray-400 text-sm">
                Connect your wallet to continue
              </p>
            )}
          </div>

          {/* Footer note */}
          <div className="px-6 py-5 bg-black/30 border-t border-white/5 text-center text-xs text-gray-500">
            Only the mint authority can create new tokens. Double-check the address.
          </div>
        </div>
      </div>
    </div>
  );
}