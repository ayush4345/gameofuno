import { ethers } from 'ethers'
import { UnoGameContract } from './types'
import UNOContractJson from '../constants/UnoGame.json'
import * as dotenv from 'dotenv';

dotenv.config()

declare global {
  interface Window {
    ethereum?: any;
  }
}

async function verifyContract(provider: ethers.Provider, address: string) {
  const code = await provider.getCode(address);
  if (code === '0x') {
    throw new Error('No contract deployed at the specified address');
  }
  console.log('Contract verified at address:', address);
}

export async function getContract(address: string) {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      // await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc')

      // const network = await provider.getNetwork()
      // console.log('Connected to network:', network.name, 'Chain ID:', network.chainId)

      const signer = await provider.getSigner(address)
      // console.log(signer)
      // const address = await signer.getAddress()
      // console.log(address)

      //TestNet
      const contractAddress = '0x75d44E5B74277478641ffc088276B11945b52f7c'
      //Local
      if (!contractAddress) {
        throw new Error('Contract address is not set');
      }
      const contractABI = UNOContractJson.abi


      await verifyContract(provider, contractAddress);
      const gameContract = new ethers.Contract(
        contractAddress!,
        contractABI,
        signer
      ) as ethers.Contract & UnoGameContract

      return { contract: gameContract }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }
  return { account: null, contract: null }
}

export async function getContractNew() {
  try {
    const rpcUrl = 'https://sepolia-rollup.arbitrum.io/rpc';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY;
    if (!KEY) {
      throw new Error('Something is missing');
    }

    const wallet = new ethers.Wallet(KEY, provider);

    // TestNet
    const contractAddress = '0x75d44E5B74277478641ffc088276B11945b52f7c';
    if (!contractAddress) {
      throw new Error('Contract address is not set');
    }

    const contractABI = UNOContractJson.abi;
    await verifyContract(provider, contractAddress);

    const gameContract = new ethers.Contract(
      contractAddress!,
      contractABI,
      wallet
    ) as ethers.Contract & UnoGameContract;

    console.log('Contract connected with wallet:', wallet.address);

    return { contract: gameContract, wallet: wallet.address };
  } catch (error) {
    console.error('Failed to connect to contract:', error);
    return { account: null, contract: null };
  }
}