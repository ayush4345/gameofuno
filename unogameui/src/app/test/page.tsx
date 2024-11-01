"use client"

import { useEffect, useState } from "react";
import { ArgentTMA, SessionAccountInterface } from "@argent/tma-wallet";
import { useLaunchParams } from "@telegram-apps/sdk-react";

function App() {
    const [userAccount, setAccount] = useState<SessionAccountInterface | undefined>();
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [argentTMA, setArgentTMA] = useState<ArgentTMA | null>(null);
    const lp = useLaunchParams();

    useEffect(() => {
        const initArgentTma = async () => {

            const { ArgentTMA } = await import('@argent/tma-wallet')


            // Initialize ArgentTMA only on the client side
            const tma = ArgentTMA.init({
                environment: "sepolia",
                appName: "zkUNO",
                appTelegramUrl: "https://t.me/zkUNOTestBot/zkUNO",
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

                    setAccount(account);
                    setIsConnected(false);
                    return;
                }

                // Connected
                const { account, callbackData } = res;
                // The session account is returned and can be used to submit transactions
                setAccount(account);
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

    // useful for debugging
    const handleClearSessionButton = async () => {
        if (!argentTMA) return;

        await argentTMA.clearSession();
        setAccount(undefined);
    };

    return (
        <>
            <div>
                <div className='text-[#ffffff] font-bold text-4xl text-shadow-md mb-2'>Hello {lp.initData?.user?.firstName ?? "User"},</div>

                {!isConnected && <button onClick={handleConnectButton}>Connect</button>}

                {isConnected && (
                    <>
                        <p>
                            Account address: <code>{userAccount?.address}</code>
                        </p>
                        <button onClick={handleClearSessionButton}>Clear Session</button>
                    </>
                )}
            </div>
        </>
    );
}

export default App;