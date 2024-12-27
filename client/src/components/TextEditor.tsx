import { useState, useEffect, useCallback } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { TOOLBAR_OPTIONS, SAVE_INTERVAL_MS } from '../constants';
import { io, Socket } from 'socket.io-client';
import { useParams } from 'react-router-dom';

export const TextEditor = () => {
    const [socket, setSocket] = useState<Socket>() ;
    const [quill, setQuill] = useState<Quill>() ;
    const { id: documentId } = useParams();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    useEffect(() => {
        const skt = io(import.meta.env.VITE_SERVER_URL, {
            reconnection: true,
            reconnectionDelay: 500, // Wait 1 second before reconnecting
        });
        
    
        skt.on("connect", () => {
            console.log("Socket connected:", skt.id); // Logs the unique socket ID
        });
    
        skt.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });
    
        skt.on("disconnect", () => {
            console.log("Socket disconnected");
        });
    
        setSocket(skt);

        // Cleanup function
        return () => {
            skt.disconnect(); // Disconnect the socket
        };
    }, []);
    
    

    const wrapperRef = useCallback((wrapper: HTMLDivElement) => {
        if(!wrapper) return ;
        wrapper.innerHTML = '' ;
    
        const editor = document.createElement("div") ;
        wrapper.append(editor) ;

        const qul = new Quill(editor, 
            { 
                theme: "snow", 
                modules: {
                toolbar: TOOLBAR_OPTIONS
              }
            });
        qul.disable() ;   
        qul.setText("Loading...") ;
        setQuill(qul) ;
    }, [])

    // Sending changes to server.
    useEffect(() => {
        if(!socket || !quill){
            return ;
        }

        // @ts-ignore
        const handler = (delta, oldDelta, source) => {
            if (source !== "user") return ;
            socket.emit("send-changes", delta) ;
        }

        quill.on("text-change", handler) ;

        return () => {
            quill.off("text-change", handler) ;
        }

    }, [socket, quill])

    // Receiving changes from server.
    useEffect(() => {
        console.log('here')

        if(!socket || !quill){
            return ;
        }

        console.log("Socket connected:", socket.connected);
        console.log("Socket ID");

        // @ts-ignore

        socket.on("receive-changes", (delta) => {
            console.log("Received changes", delta) ;
            quill.updateContents(delta) ;
        }) ;

        return () => {
            socket.off("receive-changes", (delta) => {
                console.log("Received changes", delta) ;
                quill.updateContents(delta) ;
            }) ;
        }

    }, [socket, quill, documentId, refreshTrigger])


    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshTrigger((prev) => prev + 1); // Increment trigger
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;
        if (!socket.connected) socket.connect();
    
        return () => {socket.disconnect()};
    }, [socket]);
    
    

    useEffect(() => {
        if(!socket || !quill){
            return ;
        }

        socket.once("load-document", document => {
            quill.setContents(document) ;
            quill.enable() ;
        })

        const documentName = localStorage.getItem(`document-name-for-${documentId}`) || "Untitled" ;
        socket.emit("get-document", { documentId, documentName }) ;

    }, [socket, quill, documentId])

    useEffect(() => {
        if(!socket || !quill){
            return ;
        }
        const interval = setInterval(() => {
            socket.emit("save-document", quill.getContents()) ;
        }, SAVE_INTERVAL_MS);

        return () => {
            clearInterval(interval) ;
            localStorage.clear() ;
        }
    }, [socket, quill])

    return(
        <div className="editorContainer" ref={wrapperRef}>

        </div>
    )
}