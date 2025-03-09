export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { message } = req.body;

    try {
        // 1️⃣ Crear un nuevo Thread (hilo)
        const threadResponse = await fetch("https://api.openai.com/v1/threads", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            }
        });

        const threadData = await threadResponse.json();
        if (!threadResponse.ok) {
            throw new Error(`Error al crear el hilo: ${JSON.stringify(threadData)}`);
        }

        const threadId = threadData.id; // ID del hilo creado

        // 2️⃣ Añadir el mensaje del usuario al hilo
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                role: "user",
                content: message
            })
        });

        const messageData = await messageResponse.json();
        if (!messageResponse.ok) {
            throw new Error(`Error al añadir mensaje: ${JSON.stringify(messageData)}`);
        }

        // 3️⃣ Ejecutar el asistente en el hilo
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: process.env.OPENAI_ASSISTANT_ID
            })
        });

        const runData = await runResponse.json();
        if (!runResponse.ok) {
            throw new Error(`Error al ejecutar el asistente: ${JSON.stringify(runData)}`);
        }

        const runId = runData.id;

        // 4️⃣ Esperar hasta que el asistente genere la respuesta
        let status = "in_progress";
        while (status === "in_progress" || status === "queued") {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Esperar 2 segundos
            const checkRunResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "OpenAI-Beta": "assistants=v2"
                }
            });

            const checkRunData = await checkRunResponse.json();
            if (!checkRunResponse.ok) {
                throw new Error(`Error al verificar el estado del asistente: ${JSON.stringify(checkRunData)}`);
            }

            status = checkRunData.status;
        }

        // 5️⃣ Obtener la respuesta final del asistente
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "assistants=v2"
            }
        });

        const messagesData = await messagesResponse.json();
        if (!messagesResponse.ok) {
            throw new Error(`Error al obtener la respuesta: ${JSON.stringify(messagesData)}`);
        }

        // Encontrar la última respuesta del asistente
        const assistantMessage = messagesData.data.find((msg) => msg.role === "assistant");

        res.status(200).json({ response: assistantMessage?.content || "No se pudo obtener la respuesta del asistente." });

    } catch (error) {
        console.error("❌ Error en la API de OpenAI:", error);
        res.status(500).json({ error: "Error en la solicitud a OpenAI" });
    }
}

