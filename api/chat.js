async function sendMessage() {
    const inputText = document.getElementById("textInput").value.trim();
    if (!inputText) return;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: inputText })
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        displayResponse(data.choices[0].message.content);
    } catch (error) {
        console.error("Error en la API:", error);
        displayResponse("No se pudo conectar con la IA.");
    }
}


