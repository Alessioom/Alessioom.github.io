document.addEventListener('DOMContentLoaded', function() {
    // Se si entra in chat da un annuncio, resetta solo la chat precedente (NON l'annuncio)
    if (sessionStorage.getItem('annuncioSelezionato')) {
        localStorage.removeItem("conversationData");
        localStorage.removeItem("documentId");
        // NON rimuovere sessionStorage.removeItem('annuncioSelezionato');
    }

    // Ottieni riferimenti agli elementi della pagina
    const chatLog = document.getElementById('chatLog');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const generateChatCVButton = document.getElementById('generateChatCVButton');
    const viewPDFLink = document.getElementById('viewPDFLink');
    const annuncioContainer = document.getElementById('annuncioContainer');
    const annuncioText = document.getElementById('annuncioText');

    // Variabili per la chat
    let documentId = localStorage.getItem("documentId") || null;
    let conversationData = localStorage.getItem("conversationData") ? JSON.parse(localStorage.getItem("conversationData")) : [];
    let conversationFinished = false;
    let aiGeneratedSummary = null; // Per memorizzare il riassunto generato dall'IA

    // Mostra l'annuncio selezionato SOLO se gli elementi esistono
    const annuncioSelezionato = sessionStorage.getItem('annuncioSelezionato');
    if (annuncioSelezionato && annuncioContainer && annuncioText) {
        annuncioContainer.style.display = "block";
        annuncioText.innerHTML = annuncioSelezionato;
    } else if (annuncioContainer) {
        // Nascondi il contenitore se non c'è annuncio selezionato
        annuncioContainer.style.display = "none";
    }

    // Controlla se c'è una conversazione esistente
    if (conversationData.length === 0) {
        // Messaggio iniziale diverso se c'è un annuncio selezionato
        if (annuncioSelezionato) {
            appendMessage("assistant", "Ciao! Sono qui per aiutarti a creare un CV adatto all'annuncio di lavoro selezionato. Vuoi iniziare?");
        } else {
            appendMessage("assistant", "Ciao! Sono qui per aiutarti a creare il tuo CV. Vuoi iniziare?");
        }
    } else {
        // Ripristina la conversazione precedente
        conversationData.forEach(item => {
            const parts = item.split(": ");
            if (parts.length >= 2) {
                const sender = parts[0];
                const message = parts.slice(1).join(": ");
                appendMessage(sender, message);
            }
        });
        
        // Controlla se la conversazione era già finita
        const lastUserMessage = conversationData.filter(msg => msg.startsWith("user: ")).pop();
        if (lastUserMessage &&
            (lastUserMessage.toLowerCase().includes("fine") ||
             lastUserMessage.toLowerCase().includes("fatto") ||
             lastUserMessage.toLowerCase().includes("finito") ||
             lastUserMessage.toLowerCase().includes("completato"))) {
            conversationFinished = true;
            if (generateChatCVButton) generateChatCVButton.style.display = "block";
        }
    }

    // Funzioni per la gestione della chat
    function appendMessage(sender, message) {
        const div = document.createElement('div');
        div.className = 'bubble ' + (sender === 'user' ? 'user' : 'assistant');
        div.textContent = message;
        chatLog.appendChild(div);
        chatLog.scrollTop = chatLog.scrollHeight;

        // Salva solo nella conversationData se non è già presente
        const messageToSave = `${sender}: ${message}`;
        if (!conversationData.includes(messageToSave)) {
            conversationData.push(messageToSave);
            localStorage.setItem("conversationData", JSON.stringify(conversationData));
        }
    }

    // Funzione per inviare messaggi nella chat AI
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (message === "") return;

        // Mostra il messaggio utente
        appendMessage("user", message);

        // Mostra indicatore di caricamento
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'assistant loading';
        loadingDiv.textContent = "Sto elaborando...";
        chatLog.appendChild(loadingDiv);
        chatLog.scrollTop = chatLog.scrollHeight;

        // Prepara i dati da inviare
        const requestData = {
            mode: "chat",
            message: message,
            documentId: documentId,
            conversationData: conversationData
        };

        let annuncioSelezionato = sessionStorage.getItem('annuncioSelezionato');
        if (annuncioSelezionato) {
          requestData.annuncio = JSON.parse(annuncioSelezionato);
        }

        try {
            const response = await fetch('backend.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(requestData)
            });

            const responseText = await response.text();
            
            if (chatLog.contains(loadingDiv)) {
                chatLog.removeChild(loadingDiv);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error("Errore parsing JSON:", jsonError.message);
                
                const errorMsg = document.createElement('div');
                errorMsg.className = 'assistant error';
                errorMsg.textContent = "Si è verificato un errore nella risposta del server. La risposta non è in formato JSON valido.";
                chatLog.appendChild(errorMsg);
                return;
            }

            // Visualizza la risposta dell'assistente
            appendMessage("assistant", data.message);

            // Se c'è una domanda successiva, la mostra
            if (data.nextQuestion && data.nextQuestion.trim() !== "") {
                setTimeout(() => {
                    appendMessage("assistant", data.nextQuestion);
                }, 500);
            }

            // Aggiorna l'ID del documento se fornito
            if (data.documentId) {
                documentId = data.documentId;
                localStorage.setItem("documentId", documentId);
            }

            // Gestisci il riepilogo AI generato
            if (data.aiGeneratedSummary) {
                aiGeneratedSummary = data.aiGeneratedSummary;
            }

            // Controlla se la conversazione è finita
            if (data.conversationFinished) {
                conversationFinished = true;
                if (generateChatCVButton) generateChatCVButton.style.display = "block";
            }

        } catch (fetchErr) {
            if (chatLog.contains(loadingDiv)) {
                chatLog.removeChild(loadingDiv);
            }

            console.error("Errore fetch:", fetchErr.message);

            const errorMsg = document.createElement('div');
            errorMsg.className = 'assistant error';
            errorMsg.textContent = "Errore nella comunicazione con il server: " + fetchErr.message;
            chatLog.appendChild(errorMsg);
        }

        chatInput.value = '';
    }

    // Event listeners per la chat AI
    if (sendBtn && chatInput) {
        sendBtn.addEventListener("click", sendMessage);
        chatInput.addEventListener("keydown", function(event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    // Generazione CV da chat
    if (generateChatCVButton) {
        generateChatCVButton.addEventListener("click", async function() {
            appendMessage("assistant", "Sto generando il tuo CV in PDF...");

            try {
                const payload = {
                    mode: "chat_pdf",
                    conversationData: conversationData
                };

                if (aiGeneratedSummary) {
                    payload.aiGeneratedSummary = aiGeneratedSummary;
                }

                // Aggiungi l'annuncio selezionato alla richiesta se esiste
                if (annuncioSelezionato) {
                    payload.annuncio = annuncioSelezionato;
                }

                console.log("Invio dati per PDF:", payload);

                const response = await fetch("backend.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Errore HTTP: ${response.status}`);
                }

                const responseText = await response.text();
                console.log("Risposta server per PDF:", responseText);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    console.error("Errore nel parsing JSON:", e);
                    console.log("Response raw:", responseText);
                    appendMessage("assistant", "Errore nel formato della risposta del server.");
                    return;
                }

                if (data.pdf_url) {
                    viewPDFLink.href = data.pdf_url;
                    viewPDFLink.style.display = "block";
                    generateChatCVButton.style.display = "none";
                    appendMessage("assistant", "Il tuo CV è stato generato con successo! Puoi visualizzarlo cliccando sul link qui sotto.");

                    // CORREZIONE QUI:
                    const testoCVgenerato = data.cv_text; // Prendi il testo dal JSON di risposta
                    const pdfUrl = data.pdf_url;

                    if (testoCVgenerato && pdfUrl) {
                      await fetch('backend/utils/cv.php?action=salva', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          titolo: "CV generato il " + new Date().toLocaleDateString(),
                          dati_json: testoCVgenerato,
                          pdf_url: pdfUrl // <-- aggiungi questo!
                        })
                      });
                    }
                } else if (data.error) {
                    console.error("Errore server:", data.error);
                    appendMessage("assistant", "Errore: " + data.error);
                } else {
                    console.error("Risposta senza URL o errore:", data);
                    appendMessage("assistant", "Errore nella generazione del PDF. Risposta non valida dal server.");
                }
            } catch (error) {
                console.error("Errore nella richiesta per PDF:", error);
                appendMessage("assistant", "Errore nella generazione del PDF. Riprova più tardi.");
            }
        });
    }

    // Pulsante per ripulire la conversazione
    const resetButton = document.createElement("button");
    resetButton.innerText = "Nuova Conversazione";
    resetButton.id = "resetButton";
    resetButton.style.marginTop = "10px";
    resetButton.addEventListener("click", function() {
        if (confirm("Sei sicuro di voler iniziare una nuova conversazione? Tutti i dati attuali andranno persi.")) {
            localStorage.removeItem("conversationData");
            localStorage.removeItem("documentId");
            conversationData = [];
            documentId = null;
            conversationFinished = false;
            aiGeneratedSummary = null;
            chatLog.innerHTML = ""; // Pulisce la chat
            viewPDFLink.style.display = "none";
            viewPDFLink.href = "#";
            generateChatCVButton.style.display = "none";
            
            // Messaggio iniziale diverso se c'è un annuncio selezionato
            if (annuncioSelezionato) {
                appendMessage("assistant", "Ciao! Sono qui per aiutarti a creare un CV adatto all'annuncio di lavoro selezionato. Vuoi iniziare?");
            } else {
                appendMessage("assistant", "Ciao! Sono qui per aiutarti a creare il tuo CV. Vuoi iniziare?");
            }
        }
    });

    // Aggiunge il pulsante di reset dopo il pulsante di invio
    if (sendBtn && sendBtn.parentNode) {
        sendBtn.parentNode.appendChild(resetButton);
    }
});

// Imposta l'annuncio selezionato e reindirizza alla pagina cv_ai.html
function selezionaAnnuncio(annuncio) {
    sessionStorage.setItem('annuncioSelezionato', JSON.stringify({ titolo: annuncio.titolo, descrizione: annuncio.descrizione }));
    window.location.href = 'cv_ai.html';
}