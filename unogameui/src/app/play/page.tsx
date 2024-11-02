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

const CONNECTION = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://unosocket-6k6gsdlfoa-el.a.run.app/';

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
                const activeGames = await contract.getActiveGames()
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
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "createGame",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "endGame",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "startGame",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "joinGame",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "getActiveGames",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
                            selector: "getGameState",
                        },
                        {
                            contract:
                                "0xd22DbC2094e07230E781B9914D409C69B0389cef",
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
        <div className='relative'>
            <TokenInfoBar />
            <div className='bg-white w-full max-w-[1280px] h-[720px] overflow-hidden mx-auto my-8 px-4 py-2 rounded-lg bg-cover bg-[url("/bg-2.jpg")] relative shadow-[0_0_20px_rgba(0,0,0,0.8)]'>
                <div className='absolute inset-0 bg-no-repeat bg-[url("/table-1.png")]'></div>
                <div className='absolute left-8 -right-8 top-14 -bottom-14 bg-no-repeat bg-[url("/dealer.png")] transform-gpu'>
                    <div className='absolute -left-8 right-8 -top-14 bottom-14 bg-no-repeat bg-[url("/card-0.png")] animate-pulse'></div>
                </div>
                <div className='absolute top-0 md:left-1/2 md:right-0 bottom-0 w-[calc(100%-2rem)] md:w-auto md:pr-20 py-12'>
                    <div className='text-[#ffffff] font-bold text-4xl text-shadow-md mb-2'>Hello {lp.initData?.user?.firstName ?? "User"},</div>
                    {!userAccount ?
                        <div className='relative text-center flex justify-center'>
                            <img src='/login-button-bg.png' />
                            <div className='left-1/2 -translate-x-1/2 absolute bottom-4'>
                                <StyledButton data-testid="connect" roundedStyle='rounded-full' className='bg-[#ff9000] text-2xl' onClick={handleConnectButton}>{userAccount ? `Connected Wallet` : `Connect Wallet`}</StyledButton>
                            </div>
                        </div>
                        : <>
                            <StyledButton onClick={() => createGame()} className='w-fit bg-[#00b69a] bottom-4 text-2xl my-3 mx-auto'>{createLoading == true ? 'Creating...' : 'Create Game Room'}</StyledButton>
                            <p className='text-white text-sm font-mono'>Note: Don't join the room where game is already started</p>
                            {joinLoading == true && <div className='text-white mt-2 text-2xl shadow-lg'>Wait, while we are joining your game room...</div>}
                            <h2 className="text-2xl font-bold mb-4 text-white">Active Game Rooms:</h2>
                            <ScrollArea className="h-[620px] rounded-md border border-gray-200 bg-white p-4">
                                <ul className="space-y-2">
                                    {games.toReversed().map(gameId => (
                                        <li key={gameId.toString()} className="mb-2 bg-gray-100 p-4 rounded-lg shadow flex flex-row justify-between items-center">
                                            <h2 className="text-xl font-semibold text-gray-800">Game {gameId.toString()}</h2>
                                            <StyledButton onClick={() => joinGame(gameId)} className='w-fit bg-[#00b69a] bottom-4 text-2xl'>Join Game </StyledButton>
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        </>
                    }
                    {/* {"hello" &&
                        <div className='flex flex-col items-center'>
                            <StyledButton onClick={() => router.push("/create")} className='w-fit bg-[#00b69a] bottom-4 text-2xl mt-6'>Create Table </StyledButton>
                            <StyledButton onClick={() => router.push("/game/join")} className='w-fit bg-[#00b69a] bottom-4 text-2xl mt-6'>Join Game </StyledButton>
                            {loading &&
                                <div className='text-white mt-2 text-2xl shadow-lg'>
                                    Wait, while we are retriving your details...
                                </div>
                            }
                        </div>
                    } */}
                </div>
            </div>
        </div >
    )
}