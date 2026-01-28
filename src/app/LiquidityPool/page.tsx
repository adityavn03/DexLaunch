import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { Raydium, TxVersion, CREATE_CPMM_POOL_PROGRAM, CREATE_CPMM_POOL_FEE_ACC,Cluster } from '@raydium-io/raydium-sdk-v2';
import { getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

export default function LiquidityPool() {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  const [baseMint, setBaseMint] = useState('');
  const [quoteMint, setQuoteMint] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [poolId, setPoolId] = useState('');
  const [error, setError] = useState('');
  const [associatedOnly, setAssociatedOnly] = useState(false);
  const [useSOLBalance, setUseSOLBalance] = useState(true);
 const [network, setNetwork] = useState<Cluster>('devnet');


  const createPool = async () => {
    setLoading(true);
    setStatus('Initializing...');
    setError('');
    setPoolId('');

    try {
      // Validate wallet connection
      if (!connected || !publicKey) {
        throw new Error('Please connect your wallet first');
      }

      if (!signTransaction || !signAllTransactions) {
        throw new Error('Wallet does not support transaction signing');
      }

      // Validate inputs
      if (!baseMint || !quoteMint || !baseAmount || !quoteAmount) {
        throw new Error('Please fill in all fields');
      }

      setStatus('Connecting to Solana network...');

      // Validate public keys
      let baseMintPubkey, quoteMintPubkey;
      try {
        baseMintPubkey = new PublicKey(baseMint);
        quoteMintPubkey = new PublicKey(quoteMint);
      } catch (err) {
        throw new Error('Invalid token mint address format');
      }

      setStatus('Fetching token metadata...');
      
      // Get account info first to determine the program owner
      const baseMintAccountInfo = await connection.getAccountInfo(baseMintPubkey);
      const quoteMintAccountInfo = await connection.getAccountInfo(quoteMintPubkey);

      if (!baseMintAccountInfo || !quoteMintAccountInfo) {
        throw new Error('Could not fetch mint account information. Please verify the addresses and network.');
      }

      // Determine which token program each mint uses
      const baseTokenProgram = baseMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      
      const quoteTokenProgram = quoteMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      // Fetch mint info with the correct program
      let baseMintInfo, quoteMintInfo;
      try {
        baseMintInfo = await getMint(connection, baseMintPubkey, undefined, baseTokenProgram);
        quoteMintInfo = await getMint(connection, quoteMintPubkey, undefined, quoteTokenProgram);
      } catch (err) {
        throw new Error('Failed to fetch token mint data. Ensure addresses are valid token mints on the selected network.');
      }

      const actualBaseDecimals = baseMintInfo.decimals;
      const actualQuoteDecimals = quoteMintInfo.decimals;

      setStatus(`Token decimals - Base: ${actualBaseDecimals}, Quote: ${actualQuoteDecimals}`);

      // Convert amounts using BN for precision
      const baseAmountBN = new BN(
        Math.floor(parseFloat(baseAmount) * Math.pow(10, actualBaseDecimals))
      );
      const quoteAmountBN = new BN(
        Math.floor(parseFloat(quoteAmount) * Math.pow(10, actualQuoteDecimals))
      );

      if (baseAmountBN.isZero() || quoteAmountBN.isZero()) {
        throw new Error('Token amounts must be greater than 0');
      }

      setStatus('Initializing Raydium SDK...');

      const raydium = await Raydium.load({
        connection,
        owner: publicKey,
        cluster: network,
        disableFeatureCheck: true,
        disableLoadToken: false,
        signAllTransactions: signAllTransactions,
      });

      setStatus('Fetching fee configurations...');
      const feeConfigs = await raydium.api.getCpmmConfigs();
      
      if (!feeConfigs || feeConfigs.length === 0) {
        throw new Error('No fee configurations available');
      }

      const selectedFeeConfig = feeConfigs[0];
      
      setStatus('Creating CPMM pool...');
      
      // Prepare mint objects
      const mintA = {
        address: baseMintPubkey.toString(),
        programId: baseMintAccountInfo.owner.toString(),
        decimals: actualBaseDecimals,
      };

      const mintB = {
        address: quoteMintPubkey.toString(),
        programId: quoteMintAccountInfo.owner.toString(),
        decimals: actualQuoteDecimals,
      };

      const txVersion = TxVersion.V0;

      // Create pool with all required parameters
      const { execute, extInfo } = await raydium.cpmm.createPool({
        programId: CREATE_CPMM_POOL_PROGRAM,
        poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
        mintA,
        mintB,
        mintAAmount: baseAmountBN,
        mintBAmount: quoteAmountBN,
        startTime: new BN(0),
        feeConfig: selectedFeeConfig,
        associatedOnly: associatedOnly,
        ownerInfo: {
          useSOLBalance: useSOLBalance,
        },
        txVersion,
      });

      setStatus('Please approve the transaction in your wallet...');
      
      // Execute with wallet signing
      const { txId } = await execute({ 
        sendAndConfirm: true,
      });

      setStatus('Transaction confirmed!');
      
      const createdPoolId = extInfo.address.poolId.toString();
      setPoolId(createdPoolId);
      setStatus(`Pool created successfully! Transaction: ${txId}`);
      
    } catch (err) {
      console.error('Error creating pool:', err);
      
      let errorMessage = 'Failed to create pool';
    
      
      setError(errorMessage);
      setStatus('Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-2xl w-full border border-white/20">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          Raydium Pool Creator
        </h1>
        <p className="text-gray-300 text-center mb-6">Create a CPMM liquidity pool on Solana</p>

        {/* Wallet Connection Button */}
        <div className="flex justify-center mb-8">
          <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600" />
        </div>

        {!connected && (
          <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500 mb-6">
            <p className="text-yellow-200 text-center">
              👆 Please connect your wallet to continue
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Network Selection */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as Cluster)}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading || !connected}
            >
              <option value="devnet">Devnet</option>
              <option value="mainnet">Mainnet Beta</option>
            </select>
          </div>

          {/* Base Token */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Base Token Mint Address
            </label>
            <input
              type="text"
              value={baseMint}
              onChange={(e) => setBaseMint(e.target.value)}
              placeholder="Enter base token mint address"
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading || !connected}
            />
          </div>

          {/* Quote Token */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Quote Token Mint Address
            </label>
            <input
              type="text"
              value={quoteMint}
              onChange={(e) => setQuoteMint(e.target.value)}
              placeholder="Enter quote token mint address (e.g., SOL, USDC)"
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading || !connected}
            />
          </div>

          {/* Base Amount */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Base Token Amount
            </label>
            <input
              type="number"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="Amount of base tokens"
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading || !connected}
              step="0.000000001"
            />
          </div>

          {/* Quote Amount */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Quote Token Amount
            </label>
            <input
              type="number"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="Amount of quote tokens"
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading || !connected}
              step="0.000000001"
            />
          </div>

          {/* Advanced Options */}
          <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-white font-semibold mb-2">⚙️ Advanced Options:</h3>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useSOLBalance}
                onChange={(e) => setUseSOLBalance(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={loading || !connected}
              />
              <span className="text-gray-300 text-sm">
                Use SOL balance (recommended for SOL pairs)
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={associatedOnly}
                onChange={(e) => setAssociatedOnly(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={loading || !connected}
              />
              <span className="text-gray-300 text-sm">
                Associated token accounts only
              </span>
            </label>
          </div>

          {/* Create Button */}
          <button
            onClick={createPool}
            disabled={loading || !connected}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? 'Creating Pool...' : 'Create Pool'}
          </button>

          {/* Status Messages */}
          {status && !error && (
            <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500">
              <p className="text-white font-semibold">{status}</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500">
              <p className="text-red-200 font-semibold">Error: {error}</p>
            </div>
          )}

          {poolId && (
            <div className="p-4 rounded-lg bg-green-500/20 border border-green-500">
              <p className="text-white font-semibold mb-2">Pool Created!</p>
              <p className="text-gray-200 text-sm break-all">Pool ID: {poolId}</p>
              <a
                href={`https://solscan.io/account/${poolId}${network === 'devnet' ? '?cluster=devnet' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 hover:text-purple-200 underline text-sm mt-2 block"
              >
                View on Solscan →
              </a>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-white font-semibold mb-2">📋 Instructions:</h3>
            <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
              <li>Click "Select Wallet" to connect your wallet</li>
              <li>Supports Phantom, Solflare, Backpack, and more</li>
              <li>Ensure you have sufficient SOL for transaction fees (~0.01-0.05 SOL)</li>
              <li>Enter valid token mint addresses for both tokens</li>
              <li>Specify the initial liquidity amounts for both tokens</li>
              <li>The ratio determines the initial price in the pool</li>
              <li>Approve the transaction when prompted by your wallet</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}