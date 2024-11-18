'use client'

import StyledButton from '@/components/styled-button'
import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation';
import TokenInfoBar from '@/components/TokenBar'
import { UnoGameContract } from '@/lib/types';
import { getContractNew } from '@/lib/web3';
import io, { Socket } from "socket.io-client";
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLaunchParams } from '@telegram-apps/sdk-react';
import { ArgentTMA, SessionAccountInterface } from "@argent/tma-wallet";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CONNECTION = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://tonunosocket-6k6gsdlfoa-el.a.run.app/';

export default function PlayGame() {

    const [createLoading, setCreateLoading] = useState(false)
    const [joinLoading, setJoinLoading] = useState(false)
    const [userAccount, setUserAccount] = useState<SessionAccountInterface | undefined>();
    const [contract, setContract] = useState<UnoGameContract | null>(null)
    const [games, setGames] = useState<BigInt[]>([])
    const router = useRouter()
    const lp = useLaunchParams();
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [argentTMA, setArgentTMA] = useState<ArgentTMA | null>(null);

    const socket = useRef<Socket | null>(null);

    const fetchGames = async () => {
        if (contract) {
            try {
                console.log('Fetching active games...')
                const activeGames = await contract.getNotStartedGames()
                console.log('Active games:', activeGames)
                setGames(activeGames)
            } catch (error) {
                console.error('Failed to fetch games:', error)
            }
        }
    }

    useEffect(() => {
        if (!socket.current) {
            socket.current = io(CONNECTION, {
                transports: ["websocket"],
            }) as any; // Type assertion to fix the type mismatch

            console.log("Socket connection established");
        }

    }, [socket]);

    useEffect(() => {
        if (contract) {
            console.log("Contract initialized, calling fetchGames"); // Add this line
            fetchGames();

            if (socket.current) {
                console.log("Socket connection established");
                // Add listener for gameRoomCreated event
                socket.current.on("gameRoomCreated", () => {
                    console.log("Game room created event received"); // Add this line
                    fetchGames();
                });

                // Cleanup function
                return () => {
                    if (socket.current) {
                        socket.current.off("gameRoomCreated");
                    }
                };
            }
        } else {
            console.log("Contract not initialized yet"); // Add this line
        }
    }, [contract, socket])

    useEffect(() => {
        const initArgentTma = async () => {

            const { ArgentTMA } = await import('@argent/tma-wallet')

            // Initialize ArgentTMA only on the client side
            const tma = ArgentTMA.init({
                environment: "sepolia",
                appName: "uno",
                appTelegramUrl: "https://t.me/unoTestBot/uno",
                sessionParams: {
                    allowedMethods: [
                        // List of contracts/methods allowed to be called by the session key
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "createGame",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "endGame",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "startGame",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "joinGame",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "getActiveGames",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "getNotStartedGames",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "getGameState",
                        },
                        {
                            contract:
                                "0x860b7345b2b4d3C5622aaaDec61f0E1b86F38bCf",
                            selector: "submitAction",
                        }
                    ],
                    validityDays: 90 // session validity (in days) - default: 90
                },
            });
            setArgentTMA(tma);
        }

        initArgentTma()
    }, []);

    useEffect(() => {
        if (!argentTMA) return;
        // Call connect() as soon as the app is loaded
        argentTMA
            .connect()
            .then((res) => {
                if (!res) {
                    // Not connected
                    setIsConnected(false);
                    return;
                }

                if (userAccount && userAccount.getSessionStatus() !== "VALID") {
                    // Session has expired or scope (allowed methods) has changed
                    // A new connection request should be triggered

                    // The account object is still available to get access to user's address
                    // but transactions can't be executed
                    const { account } = res;

                    setUserAccount(account.address);
                    setIsConnected(false);
                    return;
                }

                // Connected
                const { account, callbackData } = res;
                // The session account is returned and can be used to submit transactions
                setUserAccount(account.address);
                setIsConnected(true);
                // Custom data passed to the requestConnection() method is available here
                console.log("callback data:", callbackData);
            })
            .catch((err) => {
                console.error("Failed to connect", err);
            });
    }, [argentTMA, userAccount]);

    const handleConnectButton = async () => {
        if (!argentTMA) return;
        // If not connected, trigger a connection request
        // It will open the wallet and ask the user to approve the connection
        // The wallet will redirect back to the app and the account will be available
        // from the connect() method -- see above
        await argentTMA.requestConnection();
    };

    const createGame = async () => {
        if (contract) {
            try {
                setCreateLoading(true)
                console.log('Creating game...')
                const tx = await contract.createGame(userAccount as `0x${string}` | undefined)
                console.log('Transaction hash:', tx.hash)
                await tx.wait()
                console.log('Game created successfully')

                if (socket && socket.current) {
                    socket.current.emit("createGameRoom");
                }

                fetchGames()
                setCreateLoading(false)
            } catch (error) {
                console.error('Failed to create game:', error)
                setCreateLoading(false)
            }
        }
    }

    const joinGame = async (gameId: BigInt) => {
        if (contract) {
            try {
                setJoinLoading(true)
                console.log(`Joining game ${gameId.toString()}...`)
                const gameIdBigint = BigInt(gameId.toString())
                const tx = await contract.joinGame(gameIdBigint, userAccount as `0x${string}` | undefined)
                console.log('Transaction hash:', tx.hash)
                await tx.wait()

                setJoinLoading(false)

                console.log('Joined game successfully')
                router.push(`/room/${gameId.toString()}`)
            } catch (error) {
                console.error('Failed to join game:', error)
            }
        }
    }

    const setup = async () => {
        if (userAccount) {
            try {
                const { contract } = await getContractNew()
                setContract(contract)
            } catch (error) {
                console.error('Failed to setup contract:', error)
            }
        }
    }

    useEffect(() => {
        if (userAccount) {
            setup()
        } else {
            setContract(null)
        }
    }, [userAccount])

    console.log(userAccount)

    return (
        <div className='relative p-3 h-screen flex flex-col justify-between'>
            <div>
                <div className='bg-white relative rounded-2xl flex gap-5 p-3 items-center'>
                    <span>
                        <Avatar>
                            <AvatarImage src={lp.initData?.user?.photoUrl} alt="@user" />
                            <AvatarFallback>{lp.initData?.user?.firstName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </span>
                    <span>
                        <div className='font-bold'>{lp.initData?.user?.firstName}</div>
                        <div className='font-light text-gray-500 text-sm'>Go to profile</div>
                    </span>
                    {/* <TonConnectButton className='absolute right-3' /> */}
                </div>
                {!userAccount
                    ? <div className='relative text-center flex justify-center'>
                        <img src='/login-button-bg.png' />
                        <div className='left-1/2 -translate-x-1/2 absolute bottom-4'>
                            <StyledButton data-testid="connect" roundedStyle='rounded-full' className='bg-[#ff9000] text-2xl' onClick={handleConnectButton}>{userAccount ? `Connected Wallet` : `Connect Wallet`}</StyledButton>
                        </div>
                    </div>
                    : <div>
                        <div>
                            <h2 className='mt-3 text-[#000022] font-bold text-3xl'>Games list</h2>
                            <ScrollArea className='h-[calc(100vh-320px)] mt-3 rounded-2xl border-[1px] shadow-md border-[#000022] bg-white p-4'>
                                {games.toReversed().map((gameId, index) => (
                                    <div key={index} className='bg-[#000022]/10 rounded-2xl p-3 mt-3 flex gap-3 items-center justify-around hover:bg-[#000022]/20'>
                                        <div>
                                            <span className='font-bold'>Game{" "}</span>
                                            <span className='font-bold'>{gameId.toString()}</span>
                                        </div>
                                        <StyledButton onClick={() => joinGame(gameId)} className='bg-[#FF7033] max-w-24'>Join</StyledButton>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className='flex mt-3'>
                            <StyledButton onClick={() => createGame()} className='bg-[#FF7033] w-full'>{createLoading ? 'Creating...' : 'Create game'}</StyledButton>
                        </div>
                    </div>
                }
            </div>
            {/* <div className='w-full'>
                <FooterNavigation />
            </div> */}
        </div >
    )
}